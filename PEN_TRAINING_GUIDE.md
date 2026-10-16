# Add real pen detection to the project

## Important limitation
The `yolo11n.onnx` currently included in this ZIP is the original COCO model. COCO does not have a `pen` class, so changing a dashboard label alone cannot make it recognize pens. This ZIP prepares the app and provides the custom-training script, but **it does not contain a newly trained pen model** because no labeled pen dataset was provided. Do not claim pen detection is trained until you train and test it.

## What you need
- A labeled dataset in YOLO object-detection format with bounding boxes.
- For best generalization, collect diverse pen photos: ballpoint, gel, fountain, marker, different colors/shapes, horizontal/vertical angles, near/far distances, backgrounds, lighting, hands holding pens, and images without pens.
- Aim for 200–500+ varied pen images to start; more diverse correctly labeled images usually improve robustness. Split images into train and validation (and ideally test) sets. Never put the same photo in multiple splits.
- To keep the other 19 displayed categories working, the training dataset must also label those 19 categories. If you train only on pens, the model will only learn the `pen` class and the other 19 categories will not remain as custom classes.

## Dataset layout
Place your dataset under `dataset/`:
```
dataset/
  data.yaml
  images/
    train/
    val/
  labels/
    train/
    val/
```
Each image must have a matching `.txt` label file. Each label line is:
`class_id x_center y_center width height`
Coordinates are normalized between 0 and 1. Use the exact class order below in `data.yaml`.

```yaml
path: /content/real-time-object-detection-main/dataset
train: images/train
val: images/val
names:
  0: person
  1: bird
  2: laptop
  3: cell phone
  4: book
  5: bench
  6: mouse
  7: bottle
  8: backpack
  9: apple
  10: banana
  11: orange
  12: dog
  13: cat
  14: horse
  15: bus
  16: car
  17: bicycle
  18: motorcycle
  19: pen
```
Adjust the `path` to your actual dataset folder. The class IDs in every label file must match this list exactly.

## Train in Google Colab
1. Upload this project folder and your prepared `dataset/` to Google Colab, or clone your GitHub repo and upload the dataset there.
2. Select **Runtime → Change runtime type → T4 GPU** (if available).
3. Install packages:
   `!pip install ultralytics pyyaml`
4. Run from the project root:
   `!python train_pen_model.py`
5. When training completes, the script exports a 320×320 ONNX model and writes `classes.json`.
6. Test with images the model has never seen. Check that pens are boxed and that non-pen objects do not get mislabeled as pens.
7. Commit the new `yolo11n.onnx` and `classes.json` to GitHub and let Render redeploy.

## App behavior
- The UI category list changes Chair to Pen.
- Before the custom model is trained and installed, the old COCO model cannot genuinely detect pens. The app filters its results to the selected 20 categories, so pen will only appear after the custom model and class mapping are installed.
- No object detector can guarantee detection of every possible pen under every condition. Accuracy depends on the training data, camera quality, size, lighting, occlusion, and background.
