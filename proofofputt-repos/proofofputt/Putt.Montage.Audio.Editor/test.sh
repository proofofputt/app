#!/bin/bash

# This script runs a full pipeline on dummy data for testing purposes.
# It assumes Python 3 and required libraries are installed.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Starting test pipeline..."

# Define paths relative to the script's location
PROJECT_ROOT=$(dirname "$(readlink -f "$0")")
RAW_VIDEO_DIR="$PROJECT_ROOT/Raw.Video"
AV_CLIPS_DIR="$PROJECT_ROOT/AV.Clips"
HANDOVER_REPORTS_DIR="$PROJECT_ROOT/Handover.Reports"
CODE_DIR="$PROJECT_ROOT/Code"

TEST_VIDEO_PATH="$RAW_VIDEO_DIR/dummy_putt_session.mp4"
TEST_CATEGORIES_CSV="$HANDOVER_REPORTS_DIR/test_audio_categories.csv"
TEST_COMMERCIAL_MP4="$AV_CLIPS_DIR/final_videos/test_commercial.mp4"
TEST_SONG_JSON="$HANDOVER_REPORTS_DIR/dummy_song.json"

# Function to clean up generated files
clean_up() {
    echo "Cleaning up generated test files..."
    rm -f "$TEST_VIDEO_PATH"
    rm -f "$TEST_CATEGORIES_CSV"
    rm -f "$TEST_COMMERCIAL_MP4"
    rm -f "$TEST_SONG_JSON"
    rm -rf "$AV_CLIPS_DIR/raw_clips"
    rm -rf "$AV_CLIPS_DIR/base_library"
    rm -rf "$AV_CLIPS_DIR/note_library"
    echo "Cleanup complete."
}

# Run cleanup before starting the test
clean_up

# 1. Generate a dummy video file
echo "Generating dummy video..."
python3 "$CODE_DIR/create_dummy_video.py" --output_path "$TEST_VIDEO_PATH"

# 2. Run the main pipeline with dummy data
echo "Running main pipeline steps..."

# Step 1: Extract clips
echo "Step 1/4: Extracting clips..."
python3 "$PROJECT_ROOT/main_pipeline.py" --step extract_clips --input_dir "$RAW_VIDEO_DIR" --output_dir "$AV_CLIPS_DIR/raw_clips" --pre_sec 1 --post_sec 1 --threshold 0.01

# Step 2: Categorize audio
echo "Step 2/4: Categorizing audio..."
python3 "$PROJECT_ROOT/main_pipeline.py" --step categorize_audio --clips_dir "$AV_CLIPS_DIR/raw_clips" --output_csv "$TEST_CATEGORIES_CSV" --num_clusters 2

# Step 3: Modulate notes (using raw_clips as base for simplicity in test)
echo "Step 3/4: Modulating notes..."
python3 "$PROJECT_ROOT/main_pipeline.py" --step modulate_notes --base_dir "$AV_CLIPS_DIR/raw_clips" --output_dir "$AV_CLIPS_DIR/note_library" --semitone_range -1 1

# Step 4: Generate video (requires a dummy song input)
echo "Step 4/4: Generating video..."
# Create a dummy song JSON for testing
echo '[{"time": 0.0, "note": "C4", "duration": 0.5}, {"time": 1.0, "note": "E4", "duration": 0.5}, {"time": 2.0, "note": "G4", "duration": 0.5}]' > "$TEST_SONG_JSON"
python3 "$PROJECT_ROOT/main_pipeline.py" --step generate_video --notes_list "$TEST_SONG_JSON" --library_dir "$AV_CLIPS_DIR/note_library" --output_file "$TEST_COMMERCIAL_MP4" --grid_size 1x1

# Verify outputs
echo "Verifying generated files..."
if [ -f "$TEST_COMMERCIAL_MP4" ]; then
    echo "SUCCESS: Final commercial video found at '$TEST_COMMERCIAL_MP4'"
else
    echo "FAILURE: Final commercial video NOT found at '$TEST_COMMERCIAL_MP4'"
    exit 1
fi

if [ -f "$TEST_CATEGORIES_CSV" ]; then
    echo "SUCCESS: Audio categories CSV found at '$TEST_CATEGORIES_CSV'"
else
    echo "FAILURE: Audio categories CSV NOT found at '$TEST_CATEGORIES_CSV'"
    exit 1
fi

echo "Test pipeline completed successfully!"

