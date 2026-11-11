"""Screenshot images in Cloudflare R2 (S3-compatible API)."""
from functools import lru_cache
import os

import boto3


@lru_cache(maxsize=1)
def client():
    return boto3.client(
        "s3", region_name="auto",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )


def put(key: str, body: bytes, content_type: str):
    client().put_object(Bucket=os.environ["R2_BUCKET"], Key=key, Body=body, ContentType=content_type)


def get(key: str) -> bytes:
    return client().get_object(Bucket=os.environ["R2_BUCKET"], Key=key)["Body"].read()


def url(key: str) -> str:
    """Temporary link, so the bucket can stay private."""
    return client().generate_presigned_url(
        "get_object", Params={"Bucket": os.environ["R2_BUCKET"], "Key": key}, ExpiresIn=3600,
    )
