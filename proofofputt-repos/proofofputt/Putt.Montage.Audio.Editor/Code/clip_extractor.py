import argparse
import os
import logging
from moviepy.editor import VideoFileClip
from moviepy.audio.AudioClip import AudioArrayClip
import numpy as np
from scipy.signal import find_peaks
from tqdm import tqdm
import yaml

# Setup basic logging for the script if run independently
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_config(config_path):
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    return config

def get_absolute_path(base_path, relative_path):
    return os.path.abspath(os.path.join(base_path, relative_path))

def extract_clips(
    input_dir,
    output_dir,
    pre_sec,
    post_sec_override=None, # New parameter for single override
    audio_peak_threshold,
    config_path='config.yaml'
):
    """
    Processes raw videos to detect and extract clips around audio peaks.

    Args:
        input_dir (str): Directory containing raw video files.
        output_dir (str): Directory to save extracted clips.
        pre_sec (float): Seconds before hole entry to include in clip.
        post_sec_override (float, optional): If provided, overrides config and preview values for a single post_sec.
        audio_peak_threshold (float): Threshold for detecting audio peaks.
        config_path (str): Path to the configuration YAML file.
    """
    logger.info(f"Starting clip extraction from {input_dir} to {output_dir}")

    config = load_config(config_path)
    # Determine which post_sec values to use
    if post_sec_override is not None:
        post_sec_values_to_use = [post_sec_override]
        logger.info(f"  Using single post_sec override: {post_sec_override}s")
    else:
        post_sec_values_to_use = config.get('post_sec_preview_values', [config.get('clip_post_seconds', 2.0)])
        logger.info(f"  Using post_sec preview values: {post_sec_values_to_use}")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    video_files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.mp4', '.mov'))]

    if not video_files:
        logger.warning(f"No video files found in {input_dir}. Exiting.")
        return

    for video_file in tqdm(video_files, desc="Processing videos"):
        video_path = os.path.join(input_dir, video_file)
        base_name = os.path.splitext(video_file)[0]

        try:
            clip = VideoFileClip(video_path)
            audio = clip.audio

            if audio is None:
                logger.warning(f"Video {video_file} has no audio track. Skipping.")
                clip.close()
                continue

            # Get audio data as numpy array
            # moviepy's audio.to_soundarray() returns float in [-1, 1]
            audio_array = audio.to_soundarray(fps=audio.fps)
            # If stereo, take one channel for simplicity
            if audio_array.ndim > 1:
                audio_array = audio_array[:, 0] 
            
            # Calculate absolute amplitude for peak detection
            abs_audio = np.abs(audio_array)

            # Find peaks above threshold
            # `distance` parameter helps to avoid detecting multiple peaks for a single event
            # Adjust `distance` based on expected event separation (e.g., 1 second of audio samples)
            min_peak_distance_samples = int(audio.fps * 0.5) # e.g., 0.5 seconds apart
            peaks, _ = find_peaks(abs_audio, height=audio_peak_threshold, distance=min_peak_distance_samples)

            if len(peaks) == 0:
                logger.info(f"No significant audio peaks found in {video_file}.")
                clip.close()
                continue

            logger.info(f"Found {len(peaks)} audio peaks in {video_file}.")

            for i, peak_sample_idx in enumerate(peaks):
                peak_time = peak_sample_idx / audio.fps

                for current_post_sec in post_sec_values_to_use:
                    start_time = max(0, peak_time - pre_sec)
                    end_time = min(clip.duration, peak_time + current_post_sec)

                    if end_time - start_time < 0.1: # Ensure clip is not too short
                        logger.warning(f"Skipping very short clip from {video_file} at {peak_time:.2f}s with post_sec {current_post_sec}s.")
                        continue

                    subclip = clip.subclip(start_time, end_time)
                    output_clip_name = f"{base_name}_clip_{i+1}_{int(peak_time*1000)}ms_post{current_post_sec}s.mp4"
                    output_clip_path = os.path.join(output_dir, output_clip_name)

                    logger.info(f"  Extracting clip {i+1} from {video_file} ({start_time:.2f}s - {end_time:.2f}s) with post_sec {current_post_sec}s to {output_clip_name}")
                    
                    # Write the subclip. Ensure audio is included.
                    subclip.write_videofile(output_clip_path, codec="libx264", audio_codec="aac", logger=None)
                    subclip.close()

            clip.close()

        except Exception as e:
            logger.error(f"Error processing {video_file}: {e}")

    logger.info("Clip extraction complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extracts video clips based on audio peaks.")
    parser.add_argument('--input_dir', type=str, required=True,
                        help='Directory containing raw video files.')
    parser.add_argument('--output_dir', type=str, required=True,
                        help='Directory to save extracted clips.')
    parser.add_argument('--pre_sec', type=float, default=3.0,
                        help='Seconds before audio peak to include in clip (default: 3.0).')
    parser.add_argument('--post_sec', type=float, 
                        help='Override post_sec values from config for a single specific value.')
    parser.add_argument('--threshold', type=float, default=0.1,
                        help='Audio peak detection threshold (default: 0.1).')
    parser.add_argument('--config', type=str, default='config.yaml',
                        help='Path to the configuration YAML file (default: config.yaml).')

    args = parser.parse_args()

    # Resolve config path relative to script location
    script_dir = os.path.dirname(__file__)
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    config_path_abs = get_absolute_path(project_root, args.config)

    # Load config to get default values if not overridden by CLI args
    try:
        config = load_config(config_path_abs)
        pre_sec = args.pre_sec if args.pre_sec != 3.0 else config.get('clip_pre_seconds', 3.0)
        # Use args.post_sec if provided, otherwise use config's default or preview values
        post_sec_override = args.post_sec
        threshold = args.threshold if args.threshold != 0.1 else config.get('audio_peak_threshold', 0.1)
    except FileNotFoundError:
        logger.warning(f"Config file not found at {config_path_abs}. Using default CLI arguments.")
        pre_sec = args.pre_sec
        post_sec_override = args.post_sec
        threshold = args.threshold
    except Exception as e:
        logger.error(f"Error loading config file {config_path_abs}: {e}. Using default CLI arguments.")
        pre_sec = args.pre_sec
        post_sec_override = args.post_sec
        threshold = args.threshold

    extract_clips(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        pre_sec=pre_sec,
        post_sec_override=post_sec_override,
        audio_peak_threshold=threshold,
        config_path=config_path_abs
    )
