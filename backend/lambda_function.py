import json
import os
import re
import secrets
import string
import mimetypes
import boto3
from botocore.config import Config

# S3 configuration from environment variables
BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "wedding-booth-uploads")
EXPIRATION_SECONDS = int(os.environ.get("URL_EXPIRATION_SECONDS", "300"))
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    config=Config(signature_version="s3v4")
)

# Common MIME type to extension mapping fallback
MIME_EXTENSION_MAP = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/3gpp": ".3gp"
}

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Content-Type": "application/json"
}


def sanitize_username(name: str) -> str:
    """Sanitize guest name to contain only alphanumeric characters, max 40 chars."""
    if not name or not isinstance(name, str):
        return "Guest"
    # Remove leading/trailing whitespace, keep letters and digits
    sanitized = re.sub(r"[^a-zA-Z0-9]", "", name.strip())
    if not sanitized:
        return "Guest"
    return sanitized[:40]


def generate_session_code(length: int = 8) -> str:
    """Generate a random 8-character uppercase alphanumeric code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_extension(file_info: dict) -> str:
    """Determine file extension from extension field or mime type."""
    ext = file_info.get("extension")
    if ext:
        ext = ext.strip().lower()
        if not ext.startswith("."):
            ext = "." + ext
        # Validate simple extension
        if re.match(r"^\.[a-z0-9]{2,5}$", ext):
            return ext

    mime_type = (file_info.get("type") or "").strip().lower()
    if mime_type in MIME_EXTENSION_MAP:
        return MIME_EXTENSION_MAP[mime_type]

    guessed = mimetypes.guess_extension(mime_type)
    if guessed:
        if guessed == ".jpe":
            return ".jpg"
        return guessed

    return ".bin"


def lambda_handler(event, context):
    """
    AWS Lambda entrypoint to generate presigned S3 PUT URLs.
    
    Expected JSON Body:
    {
        "name": "Jane Doe",
        "files": [
            {"type": "image/jpeg", "extension": "jpg"},
            {"type": "video/mp4", "extension": "mp4"}
        ]
    }
    """
    # Handle CORS preflight
    http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod")
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "OK"})
        }

    try:
        raw_body = event.get("body")
        if not raw_body:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "Request body is empty."})
            }

        if event.get("isBase64Encoded", False):
            import base64
            raw_body = base64.b64decode(raw_body).decode("utf-8")

        payload = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
        guest_name = payload.get("name", "")
        sanitized_name = sanitize_username(guest_name)
        files = payload.get("files", [])

        if not isinstance(files, list) or len(files) == 0:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "'files' array is required."})
            }

        if len(files) > 5:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "A maximum of 5 files is permitted per session."})
            }

        session_code = generate_session_code(8)
        upload_items = []

        for index, item in enumerate(files, start=1):
            if not isinstance(item, dict):
                item = {"type": item} if isinstance(item, str) else {}
            
            mime_type = item.get("type", "application/octet-stream")
            ext = get_extension(item)
            if ext.startswith("."):
                ext = ext[1:]

            # Strict naming format: [SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]
            file_key = f"uploads/{sanitized_name}_{session_code}_{index}.{ext}"

            # Generate presigned PUT URL
            presigned_url = s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": file_key,
                    "ContentType": mime_type
                },
                ExpiresIn=EXPIRATION_SECONDS
            )

            upload_items.append({
                "itemNumber": index,
                "key": file_key,
                "uploadUrl": presigned_url,
                "contentType": mime_type
            })

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "sessionCode": session_code,
                "sanitizedName": sanitized_name,
                "count": len(upload_items),
                "items": upload_items
            })
        }

    except Exception as exc:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Failed to generate upload URLs", "details": str(exc)})
        }
