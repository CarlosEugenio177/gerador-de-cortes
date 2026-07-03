import logging
from typing import Dict

logger = logging.getLogger(__name__)

class AspectRatioService:
    """
    Service to handle FFmpeg filters for different aspect ratios.
    """
    
    # Pre-defined target aspect ratios (Width / Height)
    RATIOS: Dict[str, str] = {
        "9:16": "9/16",
        "16:9": "16/9",
        "1:1": "1/1",
        "4:5": "4/5"
    }

    @classmethod
    def get_crop_filter(cls, aspect_ratio: str) -> str:
        """
        Returns a universal FFmpeg crop filter to center-crop the video to the desired aspect ratio.
        It handles both landscape-to-portrait and portrait-to-landscape conversions dynamically
        by checking the input video's aspect ratio 'a' against the target 'R'.
        
        Filter logic:
        crop='if(gt(a, R), ih*R, iw)':'if(gt(a, R), ih, iw/R)'
        """
        if aspect_ratio not in cls.RATIOS:
            logger.warning(f"Aspect ratio '{aspect_ratio}' not standard. Falling back to 9:16.")
            aspect_ratio = "9:16"
            
        r_val = cls.RATIOS[aspect_ratio]
        
        # FFmpeg expression for center crop
        w_expr = f"if(gt(a,{r_val}),ih*({r_val}),iw)"
        h_expr = f"if(gt(a,{r_val}),ih,iw/({r_val}))"
        
        return f"crop='{w_expr}':'{h_expr}'"
        
    @classmethod
    def get_pad_filter(cls, aspect_ratio: str) -> str:
        """
        Alternatively, returns a pad filter if the user wants to fit the video 
        and add black bars instead of cropping.
        """
        if aspect_ratio not in cls.RATIOS:
            aspect_ratio = "9:16"
            
        r_val = cls.RATIOS[aspect_ratio]
        
        # FFmpeg expression for padding (fit to box with black bars)
        w_expr = f"if(gt(a,{r_val}),iw,ih*({r_val}))"
        h_expr = f"if(gt(a,{r_val}),iw/({r_val}),ih)"
        x_expr = "(ow-iw)/2"
        y_expr = "(oh-ih)/2"
        
        return f"pad='{w_expr}':'{h_expr}':'{x_expr}':'{y_expr}':black"
