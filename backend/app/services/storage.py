import os
import logging
from abc import ABC, abstractmethod
from typing import Optional
import boto3
from botocore.exceptions import ClientError
import shutil

logger = logging.getLogger(__name__)

class StorageInterface(ABC):
    @abstractmethod
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        pass

    @abstractmethod
    def download_file(self, remote_path: str, local_path: str) -> bool:
        pass

    @abstractmethod
    def get_url(self, remote_path: str) -> str:
        pass


class LocalStorageService(StorageInterface):
    def __init__(self, base_dir: str = "uploads"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        try:
            dest = os.path.join(self.base_dir, remote_path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(local_path, dest)
            return True
        except Exception as e:
            logger.error(f"Local upload failed: {e}")
            return False

    def download_file(self, remote_path: str, local_path: str) -> bool:
        try:
            src = os.path.join(self.base_dir, remote_path)
            shutil.copy2(src, local_path)
            return True
        except Exception as e:
            logger.error(f"Local download failed: {e}")
            return False

    def get_url(self, remote_path: str) -> str:
        # In a real app, this would be a route to serve the file
        return f"/media/{remote_path}"


class S3StorageService(StorageInterface):
    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        if not self.bucket_name:
            logger.error("S3_BUCKET_NAME not set")
            return False
            
        try:
            self.s3_client.upload_file(local_path, self.bucket_name, remote_path)
            return True
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            return False

    def download_file(self, remote_path: str, local_path: str) -> bool:
        if not self.bucket_name:
            logger.error("S3_BUCKET_NAME not set")
            return False
            
        try:
            self.s3_client.download_file(self.bucket_name, remote_path, local_path)
            return True
        except ClientError as e:
            logger.error(f"S3 download failed: {e}")
            return False

    def get_url(self, remote_path: str) -> str:
        if not self.bucket_name:
            return ""
        return f"https://{self.bucket_name}.s3.amazonaws.com/{remote_path}"


def get_storage_service() -> StorageInterface:
    provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    if provider == "s3":
        return S3StorageService()
    return LocalStorageService()
