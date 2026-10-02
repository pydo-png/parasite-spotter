# Malaria Scout

Please my project is Classification model for Malaria Outcome prediction and which would predict the the presence of malaria parasite in the blood of a patient, so I want you create a frontend web app/interface for me that would include Patient info (just on Patient ID,Age, sex ) and should have an input section to upload blood smear image thus could be drag and drop feature and upload too and also it should show preview grid+ auto detected species overlay and Button: Analyze smear and the maximum number of image uploads should be 10 images. this feature should accept jpg,.png - allow multiple images (batch of 5 -10 like in your drive). on the side: "Try Sample Images" with 3 parasitized +3 uninfected examples so visitors can test without uploading. And the prediction output After upload, show for each image:
and Finally build the backend too using the code below which would be used in training the model : import tensorflow as tf
from tensorflow.keras.applications import EfficientNetV2S
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import LearningRateScheduler
from tensorflow.keras.regularizers import l2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from google.colab import drive
import os  # Mount Google Drive
drive.mount('/content/drive', force_remount=True)

# Define the paths to your data directories on Google Drive
base_dir = '/content/drive/MyDrive/malaria_imgs'   train_dir = os.path.join(base_dir, 'train')
validation_dir = os.path.join(base_dir, 'val')
test_dir = os.path.join(base_dir, 'test')

positive_train_dir = os.path.join(train_dir, 'parasitized')
negative_train_dir = os.path.join(train_dir, 'non-parasitized')
positive_validation_dir = os.path.join(validation_dir, 'parasitized')
negative_validation_dir = os.path.join(validation_dir, 'non-parasitized')
positive_test_dir = os.path.join(test_dir, 'parasitized')
negative_test_dir = os.path.join(test_dir, 'non-parasitized')

# Define image dimensions and batch size
input_shape = (150, 150, 3)
batch_size = 16

# Create data generators for training, validation, and test data with augmentation
train_datagen = ImageDataGenerator(
    rescale=1.0 / 255.0,
    rotation_range=20,  # Increased rotation range
    width_shift_range=0.2,  # Increased width shift range
    height_shift_range=0.2,  # Increased height shift range
    shear_range=0.2,  # Increased shear range
    zoom_range=0.2,  # Increased zoom range
    horizontal_flip=True,
    fill_mode='nearest'
)

validation_test_datagen = ImageDataGenerator(rescale=1.0 / 255.0)

train_generator = train_datagen.flow_from_directory(
    train_dir,
    target_size=input_shape[:2],
    batch_size=batch_size,
    class_mode='binary',
    shuffle=True
)

validation_generator = validation_test_datagen.flow_from_directory(
    validation_dir,
    target_size=input_shape[:2],
    batch_size=batch_size,
    class_mode='binary',
    shuffle=False
)

test_generator = validation_test_datagen.flow_from_directory(
    test_dir,
    target_size=input_shape[:2],
    batch_size=batch_size,
    class_mode='binary',
    shuffle=False
)

# Define and compile the model (using EfficientNetV2S) with dropout and learning rate schedule
def lr_schedule(epoch):
    if epoch < 10:
        return 0.001
    elif epoch < 20:
        return 0.0001
    else:
        return 0.00001

optimizer = Adam(learning_rate=0.001)

base_model = EfficientNetV2S(weights='imagenet', include_top=False, input_shape=input_shape)

model = tf.keras.Sequential([
    base_model,
    GlobalAveragePooling2D(),
    Dense(128, activation='relu', kernel_regularizer=l2(0.01)),
    Dropout(0.4),  # Increased dropout rate
    Dense(1, activation='sigmoid')
])

model.compile(optimizer=optimizer, loss='binary_crossentropy', metrics=['accuracy'])

class CustomEarlyStopping(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        if logs is not None and 'accuracy' in logs and 'val_accuracy' in logs:
            if logs['accuracy'] >= 0.99 and logs['val_accuracy'] >= 0.98:
                print("Training and validation accuracy reached 95%. Stopping training.")
                self.model.stop_training = True

custom_early_stopping = CustomEarlyStopping()

# Train the model
epochs = 75  # You can adjust the number of epochs as needed
history = model.fit(
    train_generator,
    steps_per_epoch=len(train_generator),
    validation_data=validation_generator,
    validation_steps=len(validation_generator),
    epochs=epochs,
    callbacks=[#custom_early_stopping,
               LearningRateScheduler(lr_schedule)]
)

# Evaluate the model on the test data
test_loss, test_accuracy = model.evaluate(test_generator)
print(f"Test loss: {test_loss}")
print(f"Test accuracy: {test_accuracy}")    from tensorflow.keras.models import load_model

# Load the saved model
loaded_model = load_model("/content/drive/MyDrive/malaria_data/mal_model_epoch75.h5")from tensorflow.keras.preprocessing import image
import numpy as np
import os
import matplotlib.pyplot as plt
from math import ceil

# Define the paths to the positive and negative image directories
positive_images_dir = "/content/drive/MyDrive/malaria_imgs/trial_images/parasitized"
negative_images_dir = "/content/drive/MyDrive/malaria_imgs/trial_images/non-parasitized"

# Create a list to store the results
results = []

# Loop through positive images
for filename in os.listdir(positive_images_dir):
    if filename.endswith((".jpg", ".png", ".jpeg")):
        image_path = os.path.join(positive_images_dir, filename)

        # Load and preprocess the image
        img = image.load_img(image_path, target_size=(150, 150))  # Adjust the target size as needed
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array /= 255.0  # Rescale pixel values to [0, 1]

        # Perform inference (binary classification)
        result = loaded_model.predict(img_array)

        # Append the result to the list (1 for positive, 0 for negative) along with the score
        results.append((img, result[0][0], result[0][0]))

# Loop through negative images
for filename in os.listdir(negative_images_dir):
    if filename.endswith((".jpg", ".png", ".jpeg")):
        image_path = os.path.join(negative_images_dir, filename)

        # Load and preprocess the image
        img = image.load_img(image_path, target_size=(375, 375))  # Adjust the target size as needed
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array /= 255.0  # Rescale pixel values to [0, 1]

        # Perform inference (binary classification)
        result = loaded_model.predict(img_array)

        # Append the result to the list (1 for positive, 0 for negative) along with the score
        results.append((img, result[0][0], result[0][0]))

# Create a grid of subplots
num_images = len(results)
num_cols = 4  # Number of columns in the grid
num_rows = ceil(num_images / num_cols)  # Calculate the number of rows

plt.figure(figsize=(15, 15))  # Adjust the figure size as needed

for i, (img, prediction, score) in enumerate(results):
    plt.subplot(num_rows, num_cols, i + 1)
    plt.imshow(img)
    plt.axis('off')
    plt.title(f"Prediction: {'Positive' if prediction >= 0.70 else 'Negative'}, Score: {score:.2f}")

# Adjust spacing between subplots
plt.tight_layout()
plt.show(). " There should be a link between the frontend and the backend

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7d402545-84e0-4b47-a52c-c4e82013a1e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
