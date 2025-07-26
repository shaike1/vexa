using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Bot.Schema;
using StackExchange.Redis;
using Newtonsoft.Json;

namespace VexaSpeakerBot
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var host = CreateHostBuilder(args).Build();
            await host.RunAsync();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });
    }

    public class Startup
    {
        private readonly IConfiguration _configuration;

        public Startup(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers().AddNewtonsoftJson();

            // Create the Bot Framework Authentication to be used with the Bot Adapter
            services.AddSingleton<BotFrameworkAuthentication, ConfigurationBotFrameworkAuthentication>();

            // Create the Bot Adapter with error handling enabled
            services.AddSingleton<IBotFrameworkHttpAdapter, AdapterWithErrorHandler>();

            // Create the bot as a transient
            services.AddTransient<IBot, VexaTeamsBot>();

            // Add Redis connection
            services.AddSingleton<IConnectionMultiplexer>(provider =>
            {
                var connectionString = _configuration.GetConnectionString("Redis") ?? "localhost:6379";
                return ConnectionMultiplexer.Connect(connectionString);
            });

            // Add Local TTS Service
            services.AddSingleton<ITtsService, LocalTtsService>();
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.UseRouting();
            app.UseAuthorization();
            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
        }
    }

    public class AdapterWithErrorHandler : BotFrameworkHttpAdapter
    {
        public AdapterWithErrorHandler(IConfiguration configuration, ILogger<BotFrameworkHttpAdapter> logger)
            : base(configuration, logger)
        {
            OnTurnError = async (turnContext, exception) =>
            {
                logger.LogError(exception, $"[OnTurnError] unhandled error : {exception.Message}");
                await turnContext.SendActivityAsync("The bot encountered an error or bug.");
            };
        }
    }

    public interface ITtsService
    {
        Task SpeakAsync(string text);
    }

    public class LocalTtsService : ITtsService
    {
        private readonly ILogger<LocalTtsService> _logger;

        public LocalTtsService(ILogger<LocalTtsService> logger)
        {
            _logger = logger;
        }

        public async Task SpeakAsync(string text)
        {
            try
            {
                _logger.LogInformation($"🗣️ Speaking with local TTS: {text}");
                
                // Use espeak for local text-to-speech (write to file since no audio device in container)
                var outputFile = $"/tmp/tts_output_{DateTime.Now:yyyyMMdd_HHmmss}.wav";
                var processInfo = new ProcessStartInfo
                {
                    FileName = "espeak",
                    Arguments = $"-s 150 -v en -w \"{outputFile}\" \"{text.Replace("\"", "\\\"")}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using var process = Process.Start(processInfo);
                if (process != null)
                {
                    await process.WaitForExitAsync();
                    if (process.ExitCode == 0)
                    {
                        _logger.LogInformation($"✅ Local TTS completed successfully - Audio file created: {outputFile}");
                        
                        // For verification, log the file size
                        if (File.Exists(outputFile))
                        {
                            var fileInfo = new FileInfo(outputFile);
                            _logger.LogInformation($"📁 TTS Audio file size: {fileInfo.Length} bytes");
                        }
                    }
                    else
                    {
                        var error = await process.StandardError.ReadToEndAsync();
                        _logger.LogWarning($"⚠️ TTS warning: {error}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Local TTS error: {ex.Message}");
            }
        }
    }

    public class VexaTeamsBot : ActivityHandler
    {
        private readonly ILogger<VexaTeamsBot> _logger;
        private readonly IConnectionMultiplexer _redis;
        private readonly ITtsService _ttsService;
        private readonly ISubscriber _subscriber;

        public VexaTeamsBot(ILogger<VexaTeamsBot> logger, IConnectionMultiplexer redis, ITtsService ttsService)
        {
            _logger = logger;
            _redis = redis;
            _ttsService = ttsService;
            _subscriber = _redis.GetSubscriber();

            _logger.LogInformation("🤖 VexaTeamsBot initialized - Starting Redis subscription...");
            
            // Subscribe to Redis commands
            _ = Task.Run(async () => await SubscribeToRedisCommands());
        }

        protected override async Task OnMessageActivityAsync(ITurnContext<IMessageActivity> turnContext, CancellationToken cancellationToken)
        {
            var replyText = $"Echo: {turnContext.Activity.Text}";
            await turnContext.SendActivityAsync(MessageFactory.Text(replyText, replyText), cancellationToken);
        }

        protected override async Task OnMembersAddedAsync(IList<ChannelAccount> membersAdded, ITurnContext<IConversationUpdateActivity> turnContext, CancellationToken cancellationToken)
        {
            const string welcomeText = "Hello and welcome! I am VexaAI Speaker Bot. I can speak in Teams meetings using Azure Speech Services.";
            
            foreach (var member in membersAdded)
            {
                if (member.Id != turnContext.Activity.Recipient.Id)
                {
                    await turnContext.SendActivityAsync(MessageFactory.Text(welcomeText, welcomeText), cancellationToken);
                    
                    // Announce bot presence with speech
                    await SpeakText("VexaAI Speaker Bot has joined the meeting. I am ready to speak using local text to speech.");
                }
            }
        }

        private async Task SubscribeToRedisCommands()
        {
            try
            {
                _logger.LogInformation("Subscribing to Redis channel: bot_commands:working-speaker");
                
                await _subscriber.SubscribeAsync(RedisChannel.Literal("bot_commands:working-speaker"), async (channel, message) =>
                {
                    try
                    {
                        _logger.LogInformation($"Received Redis message: {message}");
                        
                        var command = JsonConvert.DeserializeObject<RedisCommand>(message!);
                        
                        if (command?.action == "speak" && !string.IsNullOrEmpty(command.message))
                        {
                            _logger.LogInformation($"Processing speak command: {command.message}");
                            await SpeakText(command.message);
                        }
                        else if (command?.action == "unmute")
                        {
                            _logger.LogInformation("Processing unmute command");
                            // Note: Native Teams bots don't need unmuting like browser bots
                            await SpeakText("VexaAI bot is now active and ready to speak.");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing Redis command");
                    }
                });
                
                _logger.LogInformation("Successfully subscribed to Redis channel");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to subscribe to Redis channel");
            }
        }

        private async Task SpeakText(string text)
        {
            try
            {
                _logger.LogInformation($"🎤 Received request to speak: {text}");
                
                // Use local TTS service
                await _ttsService.SpeakAsync(text);
                
                _logger.LogInformation($"✅ Local speech synthesis completed for: {text}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error during local speech synthesis: {ex.Message}");
            }
        }

        public class RedisCommand
        {
            public string action { get; set; } = "";
            public string message { get; set; } = "";
        }
    }

    [ApiController]
    [Route("api/messages")]
    public class BotController : ControllerBase
    {
        private readonly IBotFrameworkHttpAdapter _adapter;
        private readonly IBot _bot;

        public BotController(IBotFrameworkHttpAdapter adapter, IBot bot)
        {
            _adapter = adapter;
            _bot = bot;
        }

        [HttpPost]
        public async Task PostAsync()
        {
            await _adapter.ProcessAsync(Request, Response, _bot);
        }
    }
}