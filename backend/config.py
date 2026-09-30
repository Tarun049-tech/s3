import os

class Settings:
    # AWS
    AWS_ACCESS_KEY_ID:     str  = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str  = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_DEFAULT_REGION:    str  = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

    # Azure
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")

    # GCP
    GCP_SERVICE_ACCOUNT_JSON: str = os.getenv("GCP_SERVICE_ACCOUNT_JSON", "")
    GCP_PROJECT_ID:           str = os.getenv("GCP_PROJECT_ID", "")

    # Integrations
    OPENAI_API_KEY:   str  = os.getenv("OPENAI_API_KEY", "")
    SLACK_WEBHOOK_URL:str  = os.getenv("SLACK_WEBHOOK_URL", "")

    # Default mock mode
    USE_MOCK: bool = os.getenv("USE_MOCK", "true").lower() in ("true", "1", "t", "yes")

settings = Settings()

# AWS regional pricing ($/GB/month) – kept for legacy compatibility
S3_REGIONAL_RATES: dict[str, float] = {
    "us-east-1":      0.023,
    "us-east-2":      0.023,
    "us-west-1":      0.026,
    "us-west-2":      0.023,
    "eu-west-1":      0.024,
    "eu-central-1":   0.0245,
    "ap-southeast-1": 0.025,
    "ap-northeast-1": 0.025,
    "sa-east-1":      0.040,
}
DEFAULT_S3_RATE = 0.023  # $/GB/month
