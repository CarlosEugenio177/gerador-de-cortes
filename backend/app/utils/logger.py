import json
import logging
from datetime import datetime
import traceback

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        
        if hasattr(record, "project_id"):
            log_record["project_id"] = record.project_id
        if hasattr(record, "worker_id"):
            log_record["worker_id"] = record.worker_id
        if hasattr(record, "stage"):
            log_record["stage"] = record.stage
        if hasattr(record, "duration_ms"):
            log_record["duration_ms"] = record.duration_ms
        if hasattr(record, "status"):
            log_record["status"] = record.status

        if record.exc_info:
            log_record["error"] = self.formatException(record.exc_info)
            log_record["stack_trace"] = traceback.format_exc()

        return json.dumps(log_record)

def get_structured_logger(name="clipforge"):
    logger = logging.getLogger(name)
    # Prevent adding multiple handlers if get_logger is called multiple times
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        # Disable propagation to root logger to avoid duplicate prints
        logger.propagate = False
    return logger
