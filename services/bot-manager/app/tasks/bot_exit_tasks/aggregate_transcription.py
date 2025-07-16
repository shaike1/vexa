import logging
import httpx
import os
from sqlalchemy.ext.asyncio import AsyncSession
from shared_models.models import Meeting

logger = logging.getLogger(__name__)

async def run(meeting: Meeting, db: AsyncSession):
    """
    Fetches transcription data from the transcription-collector service,
    aggregates participant and language information, and updates the meeting record.
    """
    meeting_id = meeting.id
    logger.info(f"Starting transcription aggregation for meeting {meeting_id}")

    try:
        # The collector service is internal, so we can use its service name
        collector_url = f"http://transcription-collector:8000/internal/transcripts/{meeting_id}"
        
        async with httpx.AsyncClient() as client:
            logger.info(f"Calling transcription-collector for meeting {meeting_id} at {collector_url}")
            response = await client.get(collector_url, timeout=30.0) # Increased timeout
        
        if response.status_code == 200:
            transcription_segments = response.json()
            logger.info(f"Received {len(transcription_segments)} segments from collector for meeting {meeting_id}")
            
            if not transcription_segments:
                logger.info(f"No transcription segments returned for meeting {meeting_id}. Nothing to aggregate.")
                return

            # Basic extraction (existing logic)
            unique_speakers = set()
            unique_languages = set()
            
            for segment in transcription_segments:
                speaker = segment.get('speaker')
                language = segment.get('language')
                if speaker and speaker.strip():
                    unique_speakers.add(speaker.strip())
                if language and language.strip():
                    unique_languages.add(language.strip())
            
            # Enhanced AI-powered analysis
            ai_enhanced_data = await enhance_meeting_with_ai(transcription_segments, list(unique_speakers))
            
            aggregated_data = {}
            if unique_speakers:
                aggregated_data['participants'] = sorted(list(unique_speakers))
            if unique_languages:
                aggregated_data['languages'] = sorted(list(unique_languages))
            
            # Add AI enhancements
            if ai_enhanced_data:
                aggregated_data.update(ai_enhanced_data)
            
            if aggregated_data:
                # Use a flag to track if the data object was changed
                data_changed = False
                # Ensure meeting.data is a dictionary
                existing_data = meeting.data or {}
                
                # Update participants if not present
                if 'participants' not in existing_data and 'participants' in aggregated_data:
                    existing_data['participants'] = aggregated_data['participants']
                    data_changed = True

                # Update languages if not present
                if 'languages' not in existing_data and 'languages' in aggregated_data:
                    existing_data['languages'] = aggregated_data['languages']
                    data_changed = True
                
                # Add AI-enhanced fields
                ai_fields = ['speaker_roles', 'meeting_summary', 'key_decisions', 'action_items', 'ai_analysis_cost']
                for field in ai_fields:
                    if field in aggregated_data and field not in existing_data:
                        existing_data[field] = aggregated_data[field]
                        data_changed = True
                
                if data_changed:
                    meeting.data = existing_data
                    # The caller is responsible for the commit
                    logger.info(f"Auto-aggregated data for meeting {meeting_id}: Basic + AI enhanced data")
                    if 'ai_analysis_cost' in aggregated_data:
                        logger.info(f"AI analysis cost: ${aggregated_data['ai_analysis_cost']:.6f}")
                else:
                    logger.info(f"Data for 'participants' and 'languages' already exists in meeting {meeting_id}. No update performed.")

            else:
                logger.info(f"No new participants or languages to aggregate for meeting {meeting_id}")

        else:
            logger.error(f"Failed to get transcript from collector for meeting {meeting_id}. Status: {response.status_code}, Body: {response.text}")

    except httpx.RequestError as exc:
        logger.error(f"An error occurred while requesting transcript for meeting {meeting_id} from {exc.request.url!r}: {exc}", exc_info=True)
    except Exception as e:
        logger.error(f"Failed to process and aggregate data for meeting {meeting_id}: {e}", exc_info=True)

async def enhance_meeting_with_ai(transcription_segments, basic_speakers):
    """
    Use AI to enhance meeting data with summaries, speaker analysis, and key insights.
    """
    ai_adapter_url = os.getenv("AI_SERVICE_ADAPTER_URL", "http://ai-service-adapter:8000")
    
    if not transcription_segments:
        return {}
    
    # Build full transcript
    transcript_text = ""
    for segment in transcription_segments:
        speaker = segment.get('speaker', 'Unknown Speaker')
        text = segment.get('text', '')
        if text.strip():
            transcript_text += f"{speaker}: {text}\n"
    
    if not transcript_text.strip():
        return {}
    
    enhanced_data = {}
    total_cost = 0.0
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            
            # 1. Speaker analysis
            try:
                logger.info("Starting AI speaker analysis...")
                speaker_response = await client.post(
                    f"{ai_adapter_url}/analyze-speakers", 
                    json={"text": transcript_text}
                )
                if speaker_response.status_code == 200:
                    speaker_result = speaker_response.json()
                    enhanced_data['speaker_analysis'] = speaker_result.get('analysis', '')
                    total_cost += speaker_result.get('token_usage', {}).get('cost_usd', 0.0)
                    
                    # Extract roles (simple pattern matching - could be enhanced)
                    speaker_roles = {}
                    analysis = speaker_result.get('analysis', '').lower()
                    for speaker in basic_speakers:
                        if f"speaker {speaker.lower()}" in analysis or speaker.lower() in analysis:
                            if "facilitator" in analysis or "host" in analysis:
                                speaker_roles[speaker] = "facilitator"
                            elif "expert" in analysis or "technical" in analysis:
                                speaker_roles[speaker] = "expert"
                            else:
                                speaker_roles[speaker] = "participant"
                    enhanced_data['speaker_roles'] = speaker_roles
                    logger.info(f"Speaker analysis completed. Cost: ${speaker_result.get('token_usage', {}).get('cost_usd', 0.0):.6f}")
            except Exception as e:
                logger.error(f"Speaker analysis failed: {e}")
            
            # 2. Meeting summary
            try:
                logger.info("Generating meeting summary...")
                summary_response = await client.post(
                    f"{ai_adapter_url}/summarize",
                    json={"text": transcript_text, "max_length": 200}
                )
                if summary_response.status_code == 200:
                    summary_result = summary_response.json()
                    enhanced_data['meeting_summary'] = summary_result.get('summary', '')
                    total_cost += summary_result.get('token_usage', {}).get('cost_usd', 0.0)
                    logger.info(f"Meeting summary completed. Cost: ${summary_result.get('token_usage', {}).get('cost_usd', 0.0):.6f}")
            except Exception as e:
                logger.error(f"Meeting summary failed: {e}")
            
            # 3. Key decisions and action items
            try:
                logger.info("Extracting key decisions and actions...")
                analysis_prompt = f"""Based on this meeting transcript, identify:

1. KEY DECISIONS made during the meeting
2. ACTION ITEMS assigned to specific people
3. NEXT STEPS mentioned

Be concise and specific. Format as:

DECISIONS:
- [decision 1]
- [decision 2]

ACTION ITEMS:
- [person]: [task]
- [person]: [task]

NEXT STEPS:
- [step 1]
- [step 2]

Transcript:
{transcript_text}

Analysis:"""
                
                analysis_response = await client.post(
                    f"{ai_adapter_url}/generate",
                    json={"prompt": analysis_prompt, "max_tokens": 400}
                )
                if analysis_response.status_code == 200:
                    analysis_result = analysis_response.json()
                    analysis_content = analysis_result.get('content', '')
                    total_cost += analysis_result.get('token_usage', {}).get('cost_usd', 0.0)
                    
                    # Parse decisions and actions
                    if "DECISIONS:" in analysis_content:
                        decisions_section = analysis_content.split("DECISIONS:")[1].split("ACTION ITEMS:")[0].strip()
                        enhanced_data['key_decisions'] = [d.strip("- ").strip() for d in decisions_section.split("\n") if d.strip().startswith("-")]
                    
                    if "ACTION ITEMS:" in analysis_content:
                        actions_section = analysis_content.split("ACTION ITEMS:")[1].split("NEXT STEPS:")[0].strip()
                        enhanced_data['action_items'] = [a.strip("- ").strip() for a in actions_section.split("\n") if a.strip().startswith("-")]
                    
                    logger.info(f"Key analysis completed. Cost: ${analysis_result.get('token_usage', {}).get('cost_usd', 0.0):.6f}")
            except Exception as e:
                logger.error(f"Key analysis failed: {e}")
        
        enhanced_data['ai_analysis_cost'] = total_cost
        logger.info(f"AI enhancement completed. Total cost: ${total_cost:.6f}")
        
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to AI service: {e}")
    except Exception as e:
        logger.error(f"Error in AI enhancement: {e}", exc_info=True)
    
    return enhanced_data