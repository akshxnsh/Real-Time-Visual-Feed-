import boto3
import os

def upload_video(file_path: str, job_id: str) -> str:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ["STORAGE_ENDPOINT"],
        aws_access_key_id=os.environ["STORAGE_ACCESS_KEY"],
        aws_secret_access_key=os.environ["STORAGE_SECRET_KEY"],
        region_name=os.environ.get("STORAGE_REGION", "ap-south-1"),
    )

    key = f"{job_id}.mp4"
    bucket = os.environ["STORAGE_BUCKET"]

    client.upload_file(
        file_path,
        bucket,
        key,
        ExtraArgs={"ContentType": "video/mp4"},
    )

    try:
        os.remove(file_path)
    except Exception:
        pass

    project_url = os.environ["SUPABASE_PROJECT_URL"]
    return f"{project_url}/storage/v1/object/public/{bucket}/{key}"