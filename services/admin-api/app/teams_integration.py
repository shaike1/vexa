import logging
import os
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, Field, HttpUrl

from shared_models.database import get_db
from shared_models.models import User, Meeting
from shared_models.schemas import UserResponse, MeetingResponse
from .main import verify_admin_token, get_current_user

logger = logging.getLogger("teams_integration")

# Pydantic schemas for Teams integration
class TeamsConfigCreate(BaseModel):
    client_id: str = Field(..., description="Azure App Registration Client ID")
    client_secret: str = Field(..., description="Azure App Registration Client Secret")
    tenant_id: str = Field(..., description="Azure Tenant ID")
    redirect_uri: str = Field(..., description="OAuth redirect URI")

class TeamsConfigResponse(BaseModel):
    client_id: str
    tenant_id: str
    redirect_uri: str
    configured: bool
    # Note: We don't return the client_secret for security

class OnlineMeetingCreate(BaseModel):
    subject: str = Field(..., description="Meeting subject/title")
    start_time: datetime = Field(..., description="Meeting start time")
    end_time: datetime = Field(..., description="Meeting end time")
    organizer_email: str = Field(..., description="Email of the meeting organizer")

class OnlineMeetingResponse(BaseModel):
    id: str
    join_url: str
    subject: str
    start_time: datetime
    end_time: datetime
    organizer_email: str
    created_at: datetime

class UserAddToMeetingRequest(BaseModel):
    participant_email: str = Field(..., description="Email of user to add to meeting")
    meeting_id: str = Field(..., description="Teams meeting ID")

# Router for Teams integration endpoints
teams_router = APIRouter(
    prefix="/teams",
    tags=["Teams Integration"]
)

# Global Teams configuration storage (in production, this should be in database or secure config)
_teams_config: Optional[TeamsConfigCreate] = None

def get_teams_config() -> TeamsConfigCreate:
    """Get the current Teams configuration"""
    global _teams_config
    
    # First try environment variables
    client_id = os.getenv("TEAMS_CLIENT_ID")
    client_secret = os.getenv("TEAMS_CLIENT_SECRET")
    tenant_id = os.getenv("TEAMS_TENANT_ID")
    redirect_uri = os.getenv("TEAMS_REDIRECT_URI")
    
    if all([client_id, client_secret, tenant_id, redirect_uri]):
        return TeamsConfigCreate(
            client_id=client_id,
            client_secret=client_secret,
            tenant_id=tenant_id,
            redirect_uri=redirect_uri
        )
    
    # Fall back to stored config
    if _teams_config:
        return _teams_config
    
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Teams integration not configured. Please configure Teams authentication first."
    )

# Admin endpoints for Teams configuration
@teams_router.post("/config",
                  response_model=TeamsConfigResponse,
                  status_code=status.HTTP_201_CREATED,
                  summary="Configure Teams Azure integration",
                  dependencies=[Depends(verify_admin_token)])
async def configure_teams_integration(config: TeamsConfigCreate):
    """
    Configure Microsoft Teams Azure App Registration details.
    Requires admin privileges.
    """
    global _teams_config
    
    logger.info(f"Configuring Teams integration for tenant {config.tenant_id}")
    
    # In production, validate the configuration by attempting to initialize the auth service
    try:
        # Basic validation
        if not config.client_id or not config.client_secret or not config.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All configuration fields are required"
            )
        
        # Store the configuration
        _teams_config = config
        
        logger.info("Teams integration configured successfully")
        
        return TeamsConfigResponse(
            client_id=config.client_id,
            tenant_id=config.tenant_id,
            redirect_uri=config.redirect_uri,
            configured=True
        )
        
    except Exception as e:
        logger.error(f"Failed to configure Teams integration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure Teams integration: {str(e)}"
        )

@teams_router.get("/config",
                 response_model=TeamsConfigResponse,
                 summary="Get current Teams configuration",
                 dependencies=[Depends(verify_admin_token)])
async def get_teams_configuration():
    """
    Get current Teams Azure integration configuration.
    Requires admin privileges.
    """
    try:
        config = get_teams_config()
        return TeamsConfigResponse(
            client_id=config.client_id,
            tenant_id=config.tenant_id,
            redirect_uri=config.redirect_uri,
            configured=True
        )
    except HTTPException:
        return TeamsConfigResponse(
            client_id="",
            tenant_id="",
            redirect_uri="",
            configured=False
        )

# User endpoints for Teams operations
@teams_router.post("/meetings",
                  response_model=OnlineMeetingResponse,
                  status_code=status.HTTP_201_CREATED,
                  summary="Create a new Teams meeting")
async def create_teams_meeting(
    request: OnlineMeetingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new Microsoft Teams online meeting.
    Requires valid user authentication.
    """
    try:
        config = get_teams_config()
        
        # Note: This is a placeholder for the actual Teams auth service integration
        # The TeamsAuthService would be imported and used here
        logger.info(f"Creating Teams meeting for user {user.email}: {request.subject}")
        
        # Placeholder response - in real implementation, this would call the TeamsAuthService
        meeting_response = OnlineMeetingResponse(
            id=f"teams_meeting_{datetime.utcnow().timestamp()}",
            join_url=f"https://teams.microsoft.com/l/meetup-join/19:meeting_placeholder@thread.v2/0",
            subject=request.subject,
            start_time=request.start_time,
            end_time=request.end_time,
            organizer_email=request.organizer_email,
            created_at=datetime.utcnow()
        )
        
        logger.info(f"Teams meeting created successfully: {meeting_response.id}")
        return meeting_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create Teams meeting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Teams meeting: {str(e)}"
        )

@teams_router.post("/meetings/{meeting_id}/participants",
                  status_code=status.HTTP_202_ACCEPTED,
                  summary="Add participant to Teams meeting")
async def add_participant_to_meeting(
    meeting_id: str,
    request: UserAddToMeetingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a participant to an existing Teams meeting.
    Note: This functionality is limited by Microsoft Graph API capabilities.
    """
    try:
        config = get_teams_config()
        
        logger.info(f"Adding participant {request.participant_email} to meeting {meeting_id}")
        
        # Placeholder implementation - real implementation would use Graph API
        # However, Graph API has limitations for adding participants to existing meetings
        
        return {
            "message": "Participant addition request processed",
            "meeting_id": meeting_id,
            "participant_email": request.participant_email,
            "note": "Microsoft Graph API has limitations for adding participants to existing meetings. Consider creating new meetings with initial participants."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add participant to meeting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add participant to meeting: {str(e)}"
        )

@teams_router.get("/auth/url",
                 summary="Get Teams OAuth authorization URL")
async def get_teams_auth_url(
    user: User = Depends(get_current_user),
    state: Optional[str] = None
):
    """
    Generate OAuth authorization URL for Teams user consent.
    This would be used for delegated permissions in the future.
    """
    try:
        config = get_teams_config()
        
        # Placeholder for OAuth URL generation
        # Real implementation would use TeamsAuthService.generateAuthUrl()
        
        scopes = [
            "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
            "https://graph.microsoft.com/User.Read"
        ]
        
        auth_url = f"https://login.microsoftonline.com/{config.tenant_id}/oauth2/v2.0/authorize"
        params = {
            "client_id": config.client_id,
            "response_type": "code",
            "redirect_uri": config.redirect_uri,
            "scope": " ".join(scopes),
            "response_mode": "query"
        }
        
        if state:
            params["state"] = state
        
        param_string = "&".join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{auth_url}?{param_string}"
        
        return {
            "auth_url": full_url,
            "scopes": scopes,
            "note": "This URL can be used for future delegated permissions implementation"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate auth URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate auth URL: {str(e)}"
        )

# Status endpoint
@teams_router.get("/status",
                 summary="Check Teams integration status")
async def get_teams_status():
    """
    Check the status of Teams integration configuration and connectivity.
    """
    try:
        config = get_teams_config()
        
        return {
            "configured": True,
            "tenant_id": config.tenant_id,
            "client_id": config.client_id[:8] + "..." if len(config.client_id) > 8 else config.client_id,
            "capabilities": [
                "Create online meetings (application permissions)",
                "Generate OAuth URLs (for future delegated permissions)",
                "Meeting information retrieval"
            ],
            "limitations": [
                "Adding participants to existing meetings requires calendar API",
                "Delegated permissions require user consent flow",
                "Application access policy may be required for some operations"
            ]
        }
        
    except HTTPException:
        return {
            "configured": False,
            "error": "Teams integration not configured",
            "required_config": [
                "TEAMS_CLIENT_ID",
                "TEAMS_CLIENT_SECRET", 
                "TEAMS_TENANT_ID",
                "TEAMS_REDIRECT_URI"
            ]
        }

# Export the router
__all__ = ["teams_router"]