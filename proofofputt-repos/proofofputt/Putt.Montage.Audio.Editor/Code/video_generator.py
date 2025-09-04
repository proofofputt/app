import argparse
import os
import logging
import json
import random
from moviepy.editor import VideoFileClip, CompositeVideoClip, AudioFileClip, concatenate_audioclips
from moviepy.video.tools.cuts import find_video_period
from moviepy.video.fx.resize import resize
from moviepy.audio.fx.volumex import volumex
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

def note_name_to_midi(note_name):
    """
    Converts a note name (e.g., C4, G#5) to its MIDI note number.
    """
    notes = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    
    # Handle flats if necessary (e.g., Db -> C#)
    note_name = note_name.replace("Db", "C#").replace("Eb", "D#").replace("Gb", "F#").replace("Ab", "G#").replace("Bb", "A#")

    try:
        note_char = note_name.rstrip('0123456789')
        octave = int(note_name[len(note_char):])
        midi_note = notes[note_char] + (octave + 1) * 12
        return midi_note
    except (KeyError, ValueError):
        logger.warning(f"Could not convert note name {note_name} to MIDI. Returning None.")
        return None

def select_clip(
    target_note_name,
    note_library_dir,
    category_hint=None
):
    """
    Selects a suitable clip from the note library based on the target note and optional category hint.
    """
    target_midi_note = note_name_to_midi(target_note_name)
    if target_midi_note is None:
        return None

    possible_clips = []

    # Search within specific category if hint is provided
    if category_hint:
        category_path = os.path.join(note_library_dir, category_hint)
        if os.path.exists(category_path):
            for root, _, files in os.walk(category_path):
                for f in files:
                    if f.lower().endswith(('.mp4', '.mov')):
                        # Check if the filename contains the note name (e.g., C4_clip.mp4)
                        if target_note_name.replace("#", "s") in f.replace("#", "s"): # Handle # vs s in filenames
                            possible_clips.append(os.path.join(root, f))
    
    # If no category hint, or no clips found in hinted category, search all categories
    if not possible_clips:
        for root, dirs, files in os.walk(note_library_dir):
            for f in files:
                if f.lower().endswith(('.mp4', '.mov')):
                    if target_note_name.replace("#", "s") in f.replace("#", "s"): # Handle # vs s in filenames
                        possible_clips.append(os.path.join(root, f))

    if possible_clips:
        return random.choice(possible_clips) # Return a random clip if multiple match
    else:
        logger.warning(f"No suitable clip found for note {target_note_name} (category: {category_hint}).")
        return None

def video_generator(
    notes_list,
    library_dir,
    grid_size_str,
    output_file,
    config_path='config.yaml'
):
    """
    Selects modulated clips, composites into grid video with audio mix.

    Args:
        notes_list (list): List of note dictionaries (time, note, duration, category_hint).
        library_dir (str): Directory containing modulated clips (AV.Clips/note_library/).
        grid_size_str (str): Grid layout (e.g., "3x3").
        output_file (str): Path for the final output video.
        config_path (str): Path to the configuration YAML file.
    """
    logger.info(f"Starting video generation. Output: {output_file}")

    config = load_config(config_path)
    output_video_fps = config.get('output_video_fps', 30)
    output_video_codec = config.get('output_video_codec', 'libx264')
    output_video_bitrate = config.get('output_video_bitrate', '5000k')

    grid_rows, grid_cols = map(int, grid_size_str.split('x'))
    
    # Determine total video duration from notes_list
    total_duration = 0
    if notes_list:
        total_duration = max(note['time'] + note['duration'] for note in notes_list) + 1 # Add a buffer
    else:
        logger.error("Notes list is empty. Cannot generate video.")
        return

    # Placeholder for background video (e.g., a black screen)
    # Load new config parameters for resolution, pre-roll, and rotation
    pre_roll_duration_seconds = config.get('pre_roll_duration_seconds', 0.0)
    output_video_width_phone = config.get('output_video_width_phone', 1080)
    output_video_height_phone = config.get('output_video_height_phone', 1920)
    rotate_final_video_ccw_90 = config.get('rotate_final_video_ccw_90', False)

    # Determine final video dimensions based on rotation
    # If rotating 90 deg CCW, the final portrait (1080x1920) means pre-rotation was landscape (1920x1080)
    if rotate_final_video_ccw_90:
        final_width_pre_rotation = output_video_height_phone # 1920
        final_height_pre_rotation = output_video_width_phone  # 1080
    else:
        final_width_pre_rotation = output_video_width_phone
        final_height_pre_rotation = output_video_height_phone

    background_clip = ColorVideoClip((final_width_pre_rotation, final_height_pre_rotation), color=(0,0,0), duration=total_duration)

    # Calculate individual cell dimensions based on pre-rotation dimensions
    cell_width = final_width_pre_rotation // grid_cols
    cell_height = final_height_pre_rotation // grid_rows

    video_clips_to_composite = []
    audio_clips_to_mix = []

    # Calculate individual cell dimensions
    cell_width = final_width // grid_cols
    cell_height = final_height // grid_rows

    # Keep track of available grid positions
    grid_positions = [(r, c) for r in range(grid_rows) for c in range(grid_cols)]
    random.shuffle(grid_positions) # Randomize initial positions

    # Process notes and prepare clips
    for i, note_data in tqdm(enumerate(notes_list), total=len(notes_list), desc="Preparing clips"):
        note_time = note_data['time']
        note_duration = note_data['duration']
        note_name = note_data['note']
        category_hint = note_data.get('category_hint')

        selected_clip_path = select_clip(note_name, library_dir, category_hint)

        if selected_clip_path:
            try:
                clip = VideoFileClip(selected_clip_path)
                
                # Create a black pre-roll clip
                pre_roll_clip_video = ColorVideoClip((clip.w, clip.h), color=(0,0,0), duration=pre_roll_duration_seconds)
                pre_roll_clip_audio = AudioFileClip(selected_clip_path).audio.set_duration(pre_roll_duration_seconds).volumex(0) # Silence
                pre_roll_clip = pre_roll_clip_video.set_audio(pre_roll_clip_audio)

                # Concatenate pre-roll with the actual clip
                combined_clip = CompositeVideoClip([pre_roll_clip.set_start(0), clip.set_start(pre_roll_duration_seconds)])
                combined_clip = combined_clip.set_duration(pre_roll_duration_seconds + clip.duration)

                # Resize combined clip to fit cell, maintaining aspect ratio
                combined_clip = resize(combined_clip, width=cell_width, height=cell_height)

                # Assign a grid position
                if grid_positions:
                    row, col = grid_positions.pop(0) # Take a position
                    # Add it back to the end to cycle through positions
                    grid_positions.append((row, col))
                else:
                    row, col = random.choice([(r, c) for r in range(grid_rows) for c in range(grid_cols)]) # Fallback

                x_pos = col * cell_width
                y_pos = row * cell_height

                # Set start time and duration for the combined clip in the final video
                combined_clip = combined_clip.set_start(note_time).set_pos((x_pos, y_pos))
                video_clips_to_composite.append(combined_clip)

                # Extract and prepare audio from the original clip (not the pre-roll)
                if clip.audio:
                    audio_clip = clip.audio.set_start(note_time + pre_roll_duration_seconds).set_duration(note_duration)
                    audio_clips_to_mix.append(audio_clip)
                clip.close() # Close original clip after use

            except Exception as e:
                logger.error(f"Error processing clip {selected_clip_path} for note {note_name}: {e}")
        else:
            logger.warning(f"Skipping note {note_name} at {note_time}s due to no suitable clip.")

    # Composite all video clips
    final_video = CompositeVideoClip([background_clip] + video_clips_to_composite, size=(final_width_pre_rotation, final_height_pre_rotation))

    # Mix all audio clips
    if audio_clips_to_mix:
        mixed_audio = concatenate_audioclips(audio_clips_to_mix)
        final_video = final_video.set_audio(mixed_audio)
    else:
        logger.warning("No audio clips to mix. Output video will be silent.")

    # Apply final rotation if configured
    if rotate_final_video_ccw_90:
        logger.info("Rotating final video 90 degrees counter-clockwise.")
        final_video = final_video.rotate(-90)

    # Ensure output directory exists
    output_dir_path = os.path.dirname(output_file)
    if not os.path.exists(output_dir_path):
        os.makedirs(output_dir_path)

    # Write the final video file
    logger.info(f"Writing final video to {output_file}...")
    final_video.write_videofile(
        output_file,
        fps=output_video_fps,
        codec=output_video_codec,
        bitrate=output_video_bitrate,
        audio_codec="aac",
        logger=None # Suppress moviepy's internal logging to use our own
    )
    logger.info("Video generation complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generates a video montage from modulated clips based on a song's notes.")
    parser.add_argument('--notes_list', type=str, required=True,
                        help='Path to a JSON file containing the parsed notes list.')
    parser.add_argument('--library_dir', type=str, required=True,
                        help='Directory containing modulated clips (AV.Clips/note_library/).')
    parser.add_argument('--grid_size', type=str, default='3x3',
                        help='Grid layout for video (e.g., "3x3", "4x4") (default: 3x3).')
    parser.add_argument('--output_file', type=str, required=True,
                        help='Path for the final output video (e.g., AV.Clips/final_videos/commercial.mp4).')
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
        grid_size = args.grid_size if args.grid_size != '3x3' else config.get('default_grid_size', '3x3')
    except FileNotFoundError:
        logger.warning(f"Config file not found at {config_path_abs}. Using default CLI arguments.")
        grid_size = args.grid_size
    except Exception as e:
        logger.error(f"Error loading config file {config_path_abs}: {e}. Using default CLI arguments.")
        grid_size = args.grid_size

    # Load notes list from JSON file
    try:
        with open(args.notes_list, 'r') as f:
            notes_data = json.load(f)
    except FileNotFoundError:
        logger.error(f"Notes list JSON file not found at {args.notes_list}.")
        exit(1)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON format in notes list file {args.notes_list}.")
        exit(1)

    video_generator(
        notes_list=notes_data,
        library_dir=args.library_dir,
        grid_size_str=grid_size,
        output_file=args.output_file,
        config_path=config_path_abs
    )
