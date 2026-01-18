import sys
import io
import json
from PIL import Image
from transformers import pipeline

# Load the model once when the script starts
classifier = pipeline(
    "image-classification",
    model="BinhQuocNguyen/food-recognition-model"
)

def main():
    # Read raw bytes from stdin
    image_bytes = sys.stdin.buffer.read()

    # Convert bytes → PIL image
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Run inference
    predictions = classifier(image)

    # Output JSON to stdout (Node will read this)
    print(json.dumps({"predictions": predictions}))

if __name__ == "__main__":
    main()