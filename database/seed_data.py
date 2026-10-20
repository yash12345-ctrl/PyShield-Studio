import sqlite3
import json
import os
import math
import random

def seed_all_datasets(conn: sqlite3.Connection):
    """
    Seeds the catalog of datasets (Labs 6-10) and populates the offline
    relational data tables if they are empty.
    """
    cursor = conn.cursor()

    # --- 1. DATASETS CATALOG DEFINITION (Labs 6-10) ---
    catalog_entries = [
        # Lab 6: Gradient descent and backpropagation
        (
            'synthetic_classification',
            'Synthetic Classification Data',
            6,
            'Gradient descent and backpropagation',
            'classification',
            'Classification',
            '150 samples',
            '4 continuous features, 2 classes',
            'Multi-feature synthetic dataset in SQLite for linear and logistic gradient descent optimization benchmarks.',
            '''import sqlite3
import pandas as pd

# Load from local PyShield SQLite Database
conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT feature_1, feature_2, feature_3, feature_4, target FROM dataset_synthetic_classification", conn)
print(f"Loaded Synthetic Data from SQLite: {df.shape}")
print(df.head())''',
            'dataset_synthetic_classification'
        ),
        (
            'iris_flower',
            'Iris Flower Dataset',
            6,
            'Gradient descent and backpropagation',
            'classification',
            'Classification',
            '150 samples',
            '4 features (sepal/petal), 3 species',
            'Classic 3-class flower dataset (Setosa, Versicolour, Virginica) stored in SQLite for multi-class gradient descent & softmax regression.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT sepal_length, sepal_width, petal_length, petal_width, species FROM dataset_iris", conn)
print("Iris Shape from SQLite:", df.shape)
print(df.head())''',
            'dataset_iris'
        ),
        (
            'mnist_gradient',
            'MNIST Handwritten Digits',
            6,
            'Gradient descent and backpropagation',
            'vision',
            'Vision (0-9)',
            '1,797 images',
            '8x8 grayscale pixel matrices stored in SQLite',
            'Normalized 8x8 handwritten digits (0-9) stored directly in SQLite for multi-layer perceptron training and backpropagation algorithms.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, label, pixel_values FROM dataset_mnist LIMIT 100", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
y = df['label'].values
print(f"MNIST Data from SQLite: X={X.shape}, y={y.shape}")

# Visualize first 5 digits
fig, axes = plt.subplots(1, 5, figsize=(10, 2.5))
for i, ax in enumerate(axes):
    ax.imshow(X[i].reshape(8, 8), cmap='gray')
    ax.set_title(f"Digit: {y[i]}")
    ax.axis('off')
plt.tight_layout()
plt.show()''',
            'dataset_mnist'
        ),
        (
            'fashion_mnist_sample',
            'Fashion-MNIST Benchmark',
            6,
            'Gradient descent and backpropagation',
            'vision',
            'Vision (10 classes)',
            '200 samples',
            '8x8 grayscale clothing vectors in SQLite',
            'Zalando article images (T-shirt, Trouser, Pullover, Dress, Coat, Sandal, Shirt, Sneaker, Bag, Ankle boot) stored in SQLite for gradient descent.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, pixel_values FROM dataset_fashion_mnist LIMIT 50", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
labels = df['class_name'].values
print(f"Fashion-MNIST loaded from SQLite: {X.shape}")

fig, axes = plt.subplots(1, 5, figsize=(10, 2.5))
for i, ax in enumerate(axes):
    ax.imshow(X[i].reshape(8, 8), cmap='magma')
    ax.set_title(labels[i])
    ax.axis('off')
plt.tight_layout()
plt.show()''',
            'dataset_fashion_mnist'
        ),

        # Lab 7: CNN for cat and dog classification
        (
            'cats_vs_dogs',
            'Cats vs Dogs Dataset',
            7,
            'CNN for cat and dog classification',
            'vision',
            'Binary Vision',
            '100 samples',
            'Image features & pixel matrices in SQLite',
            'Standard benchmark for convolutional neural networks separating feline and canine image samples stored in SQLite.',
            '''import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label, target, color_r, color_g, color_b, ear_pointiness, whisker_score FROM dataset_cats_vs_dogs", conn)
print("Cats vs Dogs from SQLite Shape:", df.shape)
print("Class counts:\\n", df['label'].value_counts())
print(df.head())''',
            'dataset_cats_vs_dogs'
        ),
        (
            'oxford_iiit_pet',
            'Oxford-IIIT Pet Breeds',
            7,
            'CNN for cat and dog classification',
            'vision',
            'Fine-Grained Pet Breeds',
            '37 breeds',
            'Breed metadata, species, weight, fur type',
            'Fine-grained 37 category pet dataset with breed classifications, physical attributes, and species tags in SQLite.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, origin, fur_type, avg_weight_kg FROM dataset_pet_breeds", conn)
print("Pet Breeds Shape from SQLite:", df.shape)
print(df.head(10))''',
            'dataset_pet_breeds'
        ),
        (
            'cifar10',
            'CIFAR-10 Object Sample',
            7,
            'CNN for cat and dog classification',
            'vision',
            'Vision (10 classes)',
            '150 samples (10 classes)',
            'Color image features in SQLite',
            'Classic vision benchmark: airplane, automobile, bird, cat, deer, dog, frog, horse, ship, and truck stored in SQLite.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 from SQLite:", df.shape)
print("Classes:", df['class_name'].unique().tolist())
print(df.head(10))''',
            'dataset_cifar10'
        ),
        (
            'cifar100',
            'CIFAR-100 Fine-Grained Objects',
            7,
            'CNN for cat and dog classification',
            'vision',
            'Vision (100 classes)',
            '100 classes, 20 superclasses',
            'Hierarchical object classes in SQLite',
            '100 fine-grained classes grouped into 20 superclasses (aquatic mammals, fish, flowers, trees, vehicles, etc.) stored in SQLite.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, superclass FROM dataset_cifar100", conn)
print("CIFAR-100 from SQLite:", len(df), "classes across", df['superclass'].nunique(), "superclasses")
print(df.head(10))''',
            'dataset_cifar100'
        ),

        # Lab 8: LSTM
        (
            'airline_passengers',
            'Airline Passenger Time Series',
            8,
            'LSTM',
            'time-series',
            'Time Series (144 months)',
            '144 months (1949-1960)',
            'Monthly airline passenger volume in SQLite',
            'The definitive Box-Jenkins monthly international airline passengers time series for LSTM sequence forecasting.',
            '''import sqlite3
import pandas as pd
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT year_month, passengers FROM dataset_airline_passengers ORDER BY id ASC", conn)
print("Airline Passenger Records from SQLite:", len(df))
print(df.head())

plt.figure(figsize=(10, 3.5))
plt.plot(df['year_month'], df['passengers'], marker='o', markersize=3, color='#2563eb', linewidth=1.5)
plt.title("Box-Jenkins Airline Passenger Time Series (1949 - 1960)")
plt.xlabel("Month")
plt.ylabel("Passengers (Thousands)")
plt.xticks(df['year_month'][::12], rotation=45)
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()''',
            'dataset_airline_passengers'
        ),
        (
            'daily_weather',
            'Daily Weather Time Series',
            8,
            'LSTM',
            'time-series',
            'Multi-variate Weather',
            '120 observations',
            'Date, Temp (°C), Humidity, Wind, Rain in SQLite',
            'Multi-variate continuous meteorological time-series observations in SQLite ideal for multi-step LSTM forecasting.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT date, temperature_c, humidity_pct, wind_speed_kmh, precipitation_mm FROM dataset_weather_timeseries", conn)
print("Weather Observations Shape from SQLite:", df.shape)
print(df.head())''',
            'dataset_weather_timeseries'
        ),
        (
            'stock_prices',
            'Stock-Price Historical Time Series',
            8,
            'LSTM',
            'time-series',
            'Financial OHLCV',
            '100 trading days',
            'Date, Ticker, Open, High, Low, Close, Volume in SQLite',
            'Daily OHLCV equity trading time series in SQLite designed for LSTM recurrent price trend modeling and volatility prediction.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT date, ticker, open_price, high_price, low_price, close_price, volume FROM dataset_stock_prices ORDER BY id ASC", conn)
print("Stock Prices Shape from SQLite:", df.shape)
print(df.head())''',
            'dataset_stock_prices'
        ),
        (
            'imdb_reviews_lstm',
            'IMDB Movie Reviews Sentiment',
            8,
            'LSTM',
            'nlp',
            'NLP / Text Classification',
            'Curated reviews in SQLite',
            'Full review text & binary sentiment label',
            'Sentence sequences with positive/negative sentiment labels in SQLite for embedding and bidirectional LSTM network classification.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, review_text, sentiment FROM dataset_imdb_reviews", conn)
print(f"IMDB Reviews Loaded from SQLite: {len(df)}")
df['sentiment_label'] = df['sentiment'].map({1: 'Positive', 0: 'Negative'})
print(df.head())''',
            'dataset_imdb_reviews'
        ),

        # Lab 9: Recurrent Neural Network
        (
            'shakespeare_corpus',
            'Shakespeare Literary Text Corpus',
            9,
            'Recurrent Neural Network',
            'nlp',
            'Character-Level RNN',
            'Classical Soliloquies in SQLite',
            'Play, scene, character, dialogue text',
            'Shakespeare text collection in SQLite ideal for training character-level or word-level Recurrent Neural Networks (RNN).',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT play_name, character_name, dialogue_line FROM dataset_shakespeare_text", conn)
print("Total Dialogue Lines from SQLite:", len(df))

# Join all lines for character-level RNN training
corpus = " ".join(df['dialogue_line'].tolist())
print(f"Total Corpus Length: {len(corpus)} characters")
print(f"Unique Characters: {len(set(corpus))}")
print("\\nFirst 150 characters:\\n", corpus[:150])''',
            'dataset_shakespeare_text'
        ),
        (
            'reuters_newswire_rnn',
            'Reuters Newswire Topic Classification',
            9,
            'Recurrent Neural Network',
            'nlp',
            'Multi-Class NLP',
            'Curated news stories in SQLite',
            'Headline, topic label, summary',
            'Articles across key business categories (earnings, acquisitions, crude oil, forex) in SQLite for sequence RNN categorization.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT headline, topic, summary FROM dataset_reuters_newswire", conn)
print("Reuters Newswire Shape from SQLite:", df.shape)
print("Topics distribution:\\n", df['topic'].value_counts())
print(df.head())''',
            'dataset_reuters_newswire'
        ),
        (
            'imdb_reviews_rnn',
            'IMDB Reviews (RNN Language Modeling)',
            9,
            'Recurrent Neural Network',
            'nlp',
            'Sequential Text Modeling',
            'Curated reviews in SQLite',
            'Sentence sequences for recurrent token prediction',
            'Text reviews in SQLite formatted for word-level and subword RNN sequence language modeling.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, review_text, sentiment FROM dataset_imdb_reviews", conn)
print(f"IMDB Reviews from SQLite: {len(df)}")
# Token sequence demonstration
tokens = [r.lower().split() for r in df['review_text']]
print(f"Sample token sequence: {tokens[0][:8]}")''',
            'dataset_imdb_reviews'
        ),
        (
            'sequential_energy_timeseries',
            'Hourly Energy Consumption Time Series',
            9,
            'Recurrent Neural Network',
            'time-series',
            'Sequential Time Series',
            '168 hourly records (1 week)',
            'Timestamps, Megawatt power demand (MW), Grid Load %',
            'Sequential hourly time-series in SQLite modeling electricity power demand across 168 consecutive hours for RNN sequence architectures.',
            '''import sqlite3
import pandas as pd
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT timestamp, megawatts_demand, grid_load_pct FROM dataset_energy_timeseries ORDER BY id ASC", conn)
print("Hourly Energy Grid Data Loaded from SQLite:", len(df))
print(df.head())

plt.figure(figsize=(10, 3.5))
plt.plot(df['megawatts_demand'], color='#059669', linewidth=1.5)
plt.title("Sequential Hourly Electricity Demand (168 Hours / 1 Week)")
plt.xlabel("Hour")
plt.ylabel("Demand (MW)")
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()''',
            'dataset_energy_timeseries'
        ),

        # Lab 10: MNIST image compression using autoencoder
        (
            'mnist_autoencoder',
            'MNIST Compression Benchmark',
            10,
            'MNIST image compression using autoencoder',
            'vision',
            'Autoencoder / Compression',
            '1,797 digit vectors in SQLite',
            '8x8 normalized pixel matrices',
            'Handwritten digit matrices stored directly in SQLite for bottleneck autoencoder encoding, dimensionality reduction, and reconstruction.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, label, pixel_values FROM dataset_mnist LIMIT 200", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']]) / 16.0 # Normalized [0, 1]
print(f"Input Autoencoder Features: {X.shape[1]} dimensions per image")
print(f"Samples loaded from SQLite: {X.shape[0]}")

# Display first sample
plt.figure(figsize=(3, 3))
plt.imshow(X[0].reshape(8, 8), cmap='gray')
plt.title(f"Target Digit: {df['label'].iloc[0]}")
plt.axis('off')
plt.show()''',
            'dataset_mnist'
        ),
        (
            'fashion_mnist_autoencoder',
            'Fashion-MNIST Autoencoder Compression',
            10,
            'MNIST image compression using autoencoder',
            'vision',
            'Autoencoder / Compression',
            '200 clothing vectors in SQLite',
            '8x8 normalized clothing matrices',
            'Clothing item pixel representations in SQLite for non-linear dimensionality reduction and autoencoder feature extraction.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, pixel_values FROM dataset_fashion_mnist LIMIT 50", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
print("Fashion-MNIST Autoencoder Vectors from SQLite:", X.shape)

fig, axes = plt.subplots(1, 4, figsize=(8, 2))
for i, ax in enumerate(axes):
    ax.imshow(X[i].reshape(8, 8), cmap='plasma')
    ax.set_title(df['class_name'].iloc[i])
    ax.axis('off')
plt.tight_layout()
plt.show()''',
            'dataset_fashion_mnist'
        ),
        (
            'emnist_letters',
            'EMNIST Extended Letters & Digits',
            10,
            'MNIST image compression using autoencoder',
            'vision',
            'Autoencoder / Vision',
            '124 character vectors in SQLite',
            'Letters (A-Z, a-z) & Numbers',
            'Extended handwritten character set containing uppercase/lowercase English letters and digits in SQLite for autoencoder latent representation.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT character, category, label_id, pixel_values FROM dataset_emnist LIMIT 50", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
print("EMNIST Extended Characters from SQLite:", len(df))

fig, axes = plt.subplots(1, 6, figsize=(12, 2.5))
for i, ax in enumerate(axes):
    ax.imshow(X[i].reshape(8, 8), cmap='gray')
    ax.set_title(f"Char: {df['character'].iloc[i]}")
    ax.axis('off')
plt.tight_layout()
plt.show()''',
            'dataset_emnist'
        ),
        (
            'kmnist_hiragana',
            'KMNIST (Kuzushiji Japanese Characters)',
            10,
            'MNIST image compression using autoencoder',
            'vision',
            'Autoencoder / Vision',
            '100 characters in SQLite',
            '10 Hiragana Classes (8x8 matrices)',
            'Ancient Japanese Kuzushiji Hiragana cursive characters in SQLite for autoencoder reconstruction and manifold learning.',
            '''import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT character_name, hiragana_char, label_id, pixel_values FROM dataset_kmnist", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
print("KMNIST Kuzushiji Characters from SQLite:", len(df))

fig, axes = plt.subplots(1, 5, figsize=(10, 2.5))
for i, ax in enumerate(axes):
    ax.imshow(X[i].reshape(8, 8), cmap='coolwarm')
    ax.set_title(f"{df['character_name'].iloc[i]} ({df['hiragana_char'].iloc[i]})")
    ax.axis('off')
plt.tight_layout()
plt.show()''',
            'dataset_kmnist'
        ),
        # Lab 11: Variational Autoencoder (VAE)
        (
            'mnist_vae',
            'MNIST Digits (VAE Latent Space)',
            11,
            'Variational Autoencoder (VAE)',
            'generative',
            'Generative / VAE',
            '1,797 samples',
            '8x8 pixel vectors for latent mean & log-var encoding',
            'Handwritten digit matrices in SQLite for variational autoencoder probabilistic latent space modeling and reconstruction.',
            '''import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, label, pixel_values FROM dataset_mnist LIMIT 200", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']]) / 16.0
print("MNIST for VAE Latent Distribution Learning:", X.shape)
print("Ready for reparameterization trick: z = mu + sigma * epsilon")''',
            'dataset_mnist'
        ),
        (
            'fashion_mnist_vae',
            'Fashion-MNIST (VAE Clothing Generation)',
            11,
            'Variational Autoencoder (VAE)',
            'generative',
            'Generative / VAE',
            '200 samples',
            '10 clothing categories, continuous latent prior',
            'Fashion articles in SQLite for training continuous latent generative manifolds and sampling unseen garment designs.',
            '''import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, pixel_values FROM dataset_fashion_mnist", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
print("Fashion-MNIST VAE Input Shape:", X.shape)
print("Classes:", df['class_name'].unique().tolist())''',
            'dataset_fashion_mnist'
        ),
        (
            'cifar10_vae',
            'CIFAR-10 Color Images (VAE)',
            11,
            'Variational Autoencoder (VAE)',
            'generative',
            'Generative / VAE',
            '150 samples',
            'RGB color signatures (10 categories)',
            'Multi-channel color image samples in SQLite for convolutional variational autoencoders.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 for VAE Multi-Channel Synthesis:", df.shape)
print(df.head())''',
            'dataset_cifar10'
        ),
        (
            'celeba_vae',
            'CelebA Facial Attributes (VAE Face Manifold)',
            11,
            'Variational Autoencoder (VAE)',
            'generative',
            'Generative / Faces',
            '100 celebrity faces',
            'Male, Young, Smiling, Eyeglasses, Blonde, Makeup',
            'Facial attribute vectors in SQLite for learning latent semantic face vectors (e.g. smile vector arithmetic).',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, male, young, smiling, eyeglasses, blonde_hair FROM dataset_celeba", conn)
print("CelebA Face Attributes Loaded from SQLite:", df.shape)
print("Smiling faces:", df['smiling'].sum(), "| Young faces:", df['young'].sum())
print(df.head())''',
            'dataset_celeba'
        ),

        # Lab 12: Deep Convolutional GAN for color image generation
        (
            'cifar10_dcgan',
            'CIFAR-10 (DCGAN Color Generation)',
            12,
            'Deep Convolutional GAN for color image generation',
            'generative',
            'DCGAN / Color',
            '150 color samples',
            'Generator noise vector z -> 32x32 RGB tensor',
            'Color image benchmark in SQLite for adversarial generator-discriminator training and min-max game optimization.',
            '''import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 Training Set for Discriminator:", df.shape)
# Sample latent noise prior
z = np.random.normal(0, 1, (16, 100))
print(f"Generator Latent Prior Batch z: {z.shape}")''',
            'dataset_cifar10'
        ),
        (
            'celeba_dcgan',
            'CelebA (DCGAN Synthetic Face Synthesis)',
            12,
            'Deep Convolutional GAN for color image generation',
            'generative',
            'DCGAN / Faces',
            '100 face records',
            'Facial features & discriminator adversarial targets',
            'Celebrity face attribute targets in SQLite for DCGAN generator synthesis of realistic human faces from Gaussian noise.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, smiling, young, male, blonde_hair FROM dataset_celeba", conn)
print("CelebA Real Batch for DCGAN Discriminator:", df.shape)
print(df.head())''',
            'dataset_celeba'
        ),
        (
            'oxford_pet_dcgan',
            'Oxford-IIIT Pet (DCGAN Animal Synthesis)',
            12,
            'Deep Convolutional GAN for color image generation',
            'generative',
            'DCGAN / Animals',
            '17 pet breeds',
            'Canine and feline fine-grained textures',
            'Fine-grained cat and dog breed representations in SQLite for multi-class conditional DCGAN animal generation.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, fur_type FROM dataset_pet_breeds", conn)
print("Pet Breeds DCGAN Training Targets:", len(df))
print(df.head())''',
            'dataset_pet_breeds'
        ),
        (
            'stl10_dcgan',
            'STL-10 Higher-Resolution Color Images',
            12,
            'Deep Convolutional GAN for color image generation',
            'generative',
            'DCGAN / 96x96 Color',
            '100 samples (10 classes)',
            'Airplane, bird, car, cat, deer, dog, horse, monkey, ship, truck',
            'Higher-resolution color image samples in SQLite designed for DCGAN transposed convolution upsampling layers.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_stl10", conn)
print("STL-10 Color Images Loaded from SQLite:", df.shape)
print("Classes:", df['class_name'].unique().tolist())
print(df.head())''',
            'dataset_stl10'
        ),

        # Lab 13: Understand pre-trained model architecture
        (
            'architecture_inspection',
            'Pre-Trained Architectures & Benchmarks',
            13,
            'Understand pre-trained model architecture',
            'transfer-learning',
            'Architecture Analysis',
            'Modern SOTA Architectures',
            'Layer depths, FLOPs, Parameter counts, Top-1/Top-5 Acc',
            'Standard benchmark architectures (ResNet-50, VGG-16, MobileNet-V2, EfficientNet-B0) with parameter profiles and feature dimensions in SQLite.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT model_name, top_1_accuracy, top_5_accuracy, params_millions, feature_dimensions FROM dataset_imagenet_samples", conn)
print("Pre-Trained Deep Architecture Comparisons:")
print(df.to_string(index=False))''',
            'dataset_imagenet_samples'
        ),
        (
            'imagenet_samples',
            'ImageNet-1K Reference Classes & Synsets',
            13,
            'Understand pre-trained model architecture',
            'transfer-learning',
            'ImageNet Classes',
            '1,000 class taxonomy',
            'WordNet Synsets, classification categories',
            'Reference ImageNet categories and synset IDs in SQLite for inspecting output layer logit mappings.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT synset_id, class_name, model_name FROM dataset_imagenet_samples", conn)
print("ImageNet Synsets Loaded from SQLite:", len(df))
print(df.head())''',
            'dataset_imagenet_samples'
        ),

        # Lab 14: Pre-trained CNN as a feature extractor
        (
            'cats_dogs_transfer',
            'Cats vs Dogs (CNN Feature Extraction)',
            14,
            'Pre-trained CNN as a feature extractor',
            'transfer-learning',
            'Feature Extraction',
            '100 samples',
            'Penultimate bottleneck embeddings, binary targets',
            'Cat vs Dog samples in SQLite ready for extracting convolutional embeddings without retraining the backbone.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label, target, color_r, color_g, color_b, ear_pointiness, whisker_score FROM dataset_cats_vs_dogs", conn)
print("Cats vs Dogs Ready for CNN Embedding Extraction:", df.shape)
print(df.head())''',
            'dataset_cats_vs_dogs'
        ),
        (
            'oxford_pet_transfer',
            'Oxford-IIIT Pet (Fine-Grained Transfer)',
            14,
            'Pre-trained CNN as a feature extractor',
            'transfer-learning',
            'Fine-Grained Transfer',
            '17 breeds',
            'Transfer features for fine-grained pet categories',
            'Pet breed representations in SQLite for linear probing and logistic classification on top of frozen CNN features.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, origin, fur_type, avg_weight_kg FROM dataset_pet_breeds", conn)
print("Pet Breeds Loaded for Feature Transfer:", df.shape)
print(df.head())''',
            'dataset_pet_breeds'
        ),
        (
            'cifar10_transfer',
            'CIFAR-10 (Pre-trained Feature Extraction)',
            14,
            'Pre-trained CNN as a feature extractor',
            'transfer-learning',
            'Feature Extraction',
            '150 samples',
            'ResNet/MobileNet feature vectors across 10 classes',
            '10-class image samples in SQLite for training a simple linear classifier on frozen pre-trained feature vectors.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 Feature Extractor Targets:", df.shape)
print(df.head())''',
            'dataset_cifar10'
        ),
        (
            'cifar100_transfer',
            'CIFAR-100 (Deep Multi-Class Transfer)',
            14,
            'Pre-trained CNN as a feature extractor',
            'transfer-learning',
            '100-Class Transfer',
            '100 classes across 20 superclasses',
            'Hierarchical category embeddings',
            'Fine-grained 100-class dataset in SQLite evaluating pre-trained CNN generalization across diverse visual domains.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, superclass FROM dataset_cifar100", conn)
print("CIFAR-100 Loaded for Transfer Benchmark:", len(df))
print(df.head())''',
            'dataset_cifar100'
        ),
        (
            'caltech101_transfer',
            'Caltech-101 Object Categories',
            14,
            'Pre-trained CNN as a feature extractor',
            'transfer-learning',
            'Object Categorization',
            '35 object classes',
            'Accordion, airplanes, camera, elephant, etc.',
            'Classic Caltech-101 object categories in SQLite for evaluating transfer learning accuracy with small sample sizes.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT category_name, samples_count, avg_aspect_ratio, feature_descriptor FROM dataset_caltech101", conn)
print("Caltech-101 Categories Loaded from SQLite:", len(df))
print(df.head(10))''',
            'dataset_caltech101'
        ),

        # Lab 15: YOLO object detection
        (
            'coco_detection',
            'MS COCO Object Detection Annotations',
            15,
            'YOLO object detection',
            'object-detection',
            'YOLO / COCO',
            '40 bounding boxes',
            'Bbox coordinates (x, y, w, h), category labels, area',
            'Standard MS COCO detection bounding boxes in SQLite for training YOLO anchor priors and multi-scale detection loss.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, category_name, bbox_x, bbox_y, bbox_width, bbox_height FROM dataset_coco_detection", conn)
print("COCO Bounding Box Annotations Loaded from SQLite:", len(df))
print(df['category_name'].value_counts())
print(df.head())''',
            'dataset_coco_detection'
        ),
        (
            'pascal_voc_detection',
            'Pascal VOC Bounding Boxes & Ground Truth',
            15,
            'YOLO object detection',
            'object-detection',
            'YOLO / VOC',
            '35 annotations (20 classes)',
            'xmin, ymin, xmax, ymax pixel coordinates',
            'Pascal VOC ground truth bounding boxes in SQLite for evaluating mean Average Precision (mAP@0.5) and Intersection-over-Union (IoU).',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_name, class_name, xmin, ymin, xmax, ymax FROM dataset_pascal_voc", conn)
print("Pascal VOC Ground Truth Boxes Loaded from SQLite:", len(df))
print(df.head())''',
            'dataset_pascal_voc'
        ),
        (
            'open_images_detection',
            'Google Open Images Object Detection',
            15,
            'YOLO object detection',
            'object-detection',
            'YOLO / Open Images',
            '30 detection boxes',
            'Normalized [x_min, y_min, x_max, y_max], confidence',
            'Large-scale Open Images bounding boxes in SQLite for testing multi-label object detectors and non-maximum suppression (NMS).',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label_name, confidence, x_min, y_min, x_max, y_max FROM dataset_open_images", conn)
print("Open Images Detection Boxes Loaded from SQLite:", len(df))
print(df.head())''',
            'dataset_open_images'
        ),
        (
            'kitti_detection',
            'KITTI Autonomous Driving Vision Detection',
            15,
            'YOLO object detection',
            'object-detection',
            'YOLO / KITTI',
            '30 vehicle/pedestrian detections',
            'Car, Van, Pedestrian, Cyclist, distance, occlusion',
            'Autonomous driving camera detections in SQLite for training YOLO models on road scenes, occlusion levels, and distance estimation.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT frame_id, object_type, bbox_left, bbox_top, bbox_right, bbox_bottom, distance_meters FROM dataset_kitti_detection", conn)
print("KITTI Vision Ground Truth Detections Loaded:", len(df))
print(df.head())''',
            'dataset_kitti_detection'
        ),
        (
            'custom_labeled_yolo',
            'Custom Labeled YOLO Format Bounding Boxes',
            15,
            'YOLO object detection',
            'object-detection',
            'YOLO / Custom txt',
            '25 normalized targets',
            '<class_id> <x_center> <y_center> <width> <height>',
            'Exact normalized bounding box format used by YOLO .txt annotations [0-1] for direct training with Darknet and PyTorch YOLO pipelines.',
            '''import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_filename, class_id, class_label, x_center, y_center, width, height FROM dataset_custom_detection", conn)
print("Custom YOLO Annotations (<class> <x_c> <y_c> <w> <h>):", len(df))
print(df.head())''',
            'dataset_custom_detection'
        )
    ]

    # Insert or update datasets catalog
    for entry in catalog_entries:
        cursor.execute('''
            INSERT OR REPLACE INTO datasets 
            (id, name, lab_number, experiment_title, category, category_label, samples_count, features_info, description, loader_code, table_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', entry)

    # --- 2. SEED RELATIONAL DATA TABLES ---

    # Table: dataset_airline_passengers (Box-Jenkins 144 records: 1949-1960)
    cursor.execute("SELECT COUNT(*) FROM dataset_airline_passengers")
    if cursor.fetchone()[0] == 0:
        base_passengers = [
            112, 118, 132, 129, 121, 135, 148, 148, 136, 119, 104, 118, # 1949
            115, 126, 141, 135, 125, 149, 170, 170, 158, 133, 114, 140, # 1950
            145, 150, 178, 163, 172, 178, 199, 199, 184, 162, 146, 166, # 1951
            171, 180, 193, 181, 183, 218, 230, 242, 209, 191, 172, 194, # 1952
            196, 196, 236, 235, 229, 243, 264, 272, 237, 211, 180, 201, # 1953
            204, 188, 235, 227, 234, 264, 302, 293, 259, 229, 203, 229, # 1954
            242, 233, 267, 269, 270, 315, 364, 347, 312, 274, 237, 278, # 1955
            284, 277, 317, 313, 318, 374, 413, 405, 355, 306, 271, 306, # 1956
            315, 301, 356, 348, 355, 422, 465, 467, 404, 347, 305, 336, # 1957
            340, 318, 362, 348, 363, 435, 491, 505, 404, 359, 310, 337, # 1958
            360, 342, 406, 396, 420, 472, 548, 559, 463, 407, 362, 405, # 1959
            417, 391, 419, 461, 472, 535, 622, 606, 508, 461, 390, 432  # 1960
        ]
        years = range(1949, 1961)
        months = [f"{m:02d}" for m in range(1, 13)]
        records = []
        idx = 0
        for y in years:
            for m in months:
                records.append((f"{y}-{m}", base_passengers[idx]))
                idx += 1
        cursor.executemany("INSERT INTO dataset_airline_passengers (year_month, passengers) VALUES (?, ?)", records)

    # Table: dataset_iris
    cursor.execute("SELECT COUNT(*) FROM dataset_iris")
    if cursor.fetchone()[0] == 0:
        iris_sample_data = [
            (5.1, 3.5, 1.4, 0.2, 'setosa'), (4.9, 3.0, 1.4, 0.2, 'setosa'),
            (4.7, 3.2, 1.3, 0.2, 'setosa'), (4.6, 3.1, 1.5, 0.2, 'setosa'),
            (5.0, 3.6, 1.4, 0.2, 'setosa'), (5.4, 3.9, 1.7, 0.4, 'setosa'),
            (4.6, 3.4, 1.4, 0.3, 'setosa'), (5.0, 3.4, 1.5, 0.2, 'setosa'),
            (4.4, 2.9, 1.4, 0.2, 'setosa'), (4.9, 3.1, 1.5, 0.1, 'setosa'),
            (7.0, 3.2, 4.7, 1.4, 'versicolor'), (6.4, 3.2, 4.5, 1.5, 'versicolor'),
            (6.9, 3.1, 4.9, 1.5, 'versicolor'), (5.5, 2.3, 4.0, 1.3, 'versicolor'),
            (6.5, 2.8, 4.6, 1.5, 'versicolor'), (5.7, 2.8, 4.5, 1.3, 'versicolor'),
            (6.3, 3.3, 4.7, 1.6, 'versicolor'), (4.9, 2.4, 3.3, 1.0, 'versicolor'),
            (6.6, 2.9, 4.6, 1.3, 'versicolor'), (5.2, 2.7, 3.9, 1.4, 'versicolor'),
            (6.3, 3.3, 6.0, 2.5, 'virginica'), (5.8, 2.7, 5.1, 1.9, 'virginica'),
            (7.1, 3.0, 5.9, 2.1, 'virginica'), (6.3, 2.9, 5.6, 1.8, 'virginica'),
            (6.5, 3.0, 5.8, 2.2, 'virginica'), (7.6, 3.0, 6.6, 2.1, 'virginica'),
            (4.9, 2.5, 4.5, 1.7, 'virginica'), (7.3, 2.9, 6.3, 1.8, 'virginica'),
            (6.7, 2.5, 5.8, 1.8, 'virginica'), (7.2, 3.6, 6.1, 2.5, 'virginica')
        ]
        cursor.executemany(
            "INSERT INTO dataset_iris (sepal_length, sepal_width, petal_length, petal_width, species) VALUES (?, ?, ?, ?, ?)",
            iris_sample_data
        )

    # Table: dataset_synthetic_classification
    cursor.execute("SELECT COUNT(*) FROM dataset_synthetic_classification")
    if cursor.fetchone()[0] == 0:
        syn_records = []
        random.seed(42)
        for _ in range(150):
            t = random.randint(0, 1)
            mean = 1.8 if t == 1 else -1.8
            f1 = round(random.gauss(mean, 1.1), 4)
            f2 = round(random.gauss(mean * 0.7, 0.9), 4)
            f3 = round(random.gauss(0.0, 1.0), 4)
            f4 = round(random.gauss(mean * 0.5, 1.2), 4)
            syn_records.append((f1, f2, f3, f4, t))
        cursor.executemany(
            "INSERT INTO dataset_synthetic_classification (feature_1, feature_2, feature_3, feature_4, target) VALUES (?, ?, ?, ?, ?)",
            syn_records
        )

    # Table: dataset_weather_timeseries
    cursor.execute("SELECT COUNT(*) FROM dataset_weather_timeseries")
    if cursor.fetchone()[0] == 0:
        weather_records = []
        for d in range(1, 121):
            date_str = f"2024-{(d//30)+1:02d}-{(d%30)+1:02d}"
            temp = round(18.0 + 10.0 * math.sin(d / 15.0) + random.uniform(-2, 2), 2)
            hum = round(55.0 + 20.0 * math.cos(d / 12.0) + random.uniform(-5, 5), 1)
            wind = round(12.0 + random.uniform(0, 18), 1)
            precip = round(random.uniform(0, 8.5) if random.random() > 0.75 else 0.0, 2)
            weather_records.append((date_str, temp, hum, wind, precip))
        cursor.executemany(
            "INSERT INTO dataset_weather_timeseries (date, temperature_c, humidity_pct, wind_speed_kmh, precipitation_mm) VALUES (?, ?, ?, ?, ?)",
            weather_records
        )

    # Table: dataset_stock_prices
    cursor.execute("SELECT COUNT(*) FROM dataset_stock_prices")
    if cursor.fetchone()[0] == 0:
        stock_records = []
        price = 150.0
        for i in range(1, 101):
            date_str = f"2024-{(i//22)+1:02d}-{(i%22)+1:02d}"
            change = random.uniform(-3.5, 3.8)
            open_p = round(price, 2)
            close_p = round(price + change, 2)
            high_p = round(max(open_p, close_p) + random.uniform(0.5, 2.0), 2)
            low_p = round(min(open_p, close_p) - random.uniform(0.5, 2.0), 2)
            vol = random.randint(1200000, 5400000)
            stock_records.append((date_str, 'TECH-INDEX', open_p, high_p, low_p, close_p, vol))
            price = close_p
        cursor.executemany(
            "INSERT INTO dataset_stock_prices (date, ticker, open_price, high_price, low_price, close_price, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
            stock_records
        )

    # Table: dataset_imdb_reviews
    cursor.execute("SELECT COUNT(*) FROM dataset_imdb_reviews")
    if cursor.fetchone()[0] == 0:
        imdb_records = [
            ("A masterpiece of cinematic storytelling with stunning performances and breathtaking pacing.", 1),
            ("Terrible acting and utterly predictable plot. A complete waste of time.", 0),
            ("Brilliant direction, haunting musical score, and emotional depth that lingers for days.", 1),
            ("Boring, drawn out, and lacks any character development or believable tension.", 0),
            ("One of the best movies of the decade! Highly recommended for all film lovers.", 1),
            ("Awful dialogue and cheap visual effects ruin what could have been an interesting premise.", 0),
            ("Exceptional cinematography and poignant performances from the entire cast.", 1),
            ("Couldn't even finish watching it. So incredibly dull and poorly directed.", 0),
            ("An absolute tour de force! Keeps you glued to your seat from start to finish.", 1),
            ("Uninspired script, wooden acting, and disjointed editing that makes no sense.", 0),
            ("Mesmerizing soundtrack and deeply moving character arcs make this an instant classic.", 1),
            ("Painfully slow and pretentious with zero emotional payoff in the end.", 0),
            ("A heartwarming and genuinely funny adventure with a sharp, witty screenplay.", 1),
            ("Clichéd, lazy filmmaking that relies entirely on exhausted tropes and tropes.", 0),
            ("Spectacular visuals and a thrilling narrative that delivers on every level.", 1)
        ]
        cursor.executemany("INSERT INTO dataset_imdb_reviews (review_text, sentiment) VALUES (?, ?)", imdb_records)

    # Table: dataset_shakespeare_text
    cursor.execute("SELECT COUNT(*) FROM dataset_shakespeare_text")
    if cursor.fetchone()[0] == 0:
        shakespeare_records = [
            ("Hamlet", "Act III, Scene 1", "Hamlet", "To be, or not to be, that is the question:"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "Whether 'tis nobler in the mind to suffer"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "The slings and arrows of outrageous fortune,"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "Or to take arms against a sea of troubles,"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "And by opposing end them. To die—to sleep,"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "No more; and by a sleep to say we end"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "The heart-ache and the thousand natural shocks"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "That flesh is heir to: 'tis a consummation"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "Devoutly to be wish'd. To die, to sleep;"),
            ("Hamlet", "Act III, Scene 1", "Hamlet", "To sleep, perchance to dream—ay, there's the rub:"),
            ("Romeo and Juliet", "Act II, Scene 2", "Romeo", "But, soft! what light through yonder window breaks?"),
            ("Romeo and Juliet", "Act II, Scene 2", "Romeo", "It is the east, and Juliet is the sun."),
            ("Romeo and Juliet", "Act II, Scene 2", "Juliet", "O Romeo, Romeo! wherefore art thou Romeo?"),
            ("Romeo and Juliet", "Act II, Scene 2", "Juliet", "Deny thy father and refuse thy name;"),
            ("Macbeth", "Act V, Scene 5", "Macbeth", "Tomorrow, and tomorrow, and tomorrow,"),
            ("Macbeth", "Act V, Scene 5", "Macbeth", "Creeps in this petty pace from day to day,"),
            ("Macbeth", "Act V, Scene 5", "Macbeth", "To the last syllable of recorded time;")
        ]
        cursor.executemany(
            "INSERT INTO dataset_shakespeare_text (play_name, scene_label, character_name, dialogue_line) VALUES (?, ?, ?, ?)",
            shakespeare_records
        )

    # Table: dataset_reuters_newswire
    cursor.execute("SELECT COUNT(*) FROM dataset_reuters_newswire")
    if cursor.fetchone()[0] == 0:
        reuters_records = [
            ("CENTRAL BANK CUTS BENCHMARK INTEREST RATES BY 25 BASIS POINTS", "monetary-policy", "The central committee opted for easing to stimulate industrial output and investment."),
            ("TECH GIANT ANNOUNCES STRATEGIC ACQUISITION OF CLOUD PLATFORM", "acquisitions", "The all-cash transaction valued at 4.2 billion dollars expands regional cloud infrastructure."),
            ("CRUDE OIL FUTURES SURGE AMID TIGHTENING GLOBAL SUPPLY FORECAST", "crude-oil", "Brent crude rose 3.4% following unexpected drawdown in weekly commercial reserves."),
            ("QUARTERLY CORPORATE EARNINGS BEAT WALL STREET CONSENSUS", "earnings", "Operating revenue increased 14% year-over-year driven by semiconductor demand."),
            ("CURRENCY EXCHANGE MARKETS STABILIZE AS INFLATION DATA MODERATES", "forex", "The domestic index held steady against major currencies following the monthly CPI release.")
        ]
        cursor.executemany("INSERT INTO dataset_reuters_newswire (headline, topic, summary) VALUES (?, ?, ?)", reuters_records)

    # Table: dataset_pet_breeds (Oxford-IIIT Pet)
    cursor.execute("SELECT COUNT(*) FROM dataset_pet_breeds")
    if cursor.fetchone()[0] == 0:
        pet_records = [
            ("Abyssinian", "Cat", "Egypt / Ethiopia", "Short, ticked", 4.0),
            ("Bengal", "Cat", "United States", "Spotted / Marbled", 5.5),
            ("Birman", "Cat", "Myanmar", "Semi-longhair", 4.5),
            ("Maine Coon", "Cat", "United States", "Long, dense", 7.5),
            ("Persian", "Cat", "Iran", "Long, silky", 4.2),
            ("Siamese", "Cat", "Thailand", "Short, fine", 3.8),
            ("Sphynx", "Cat", "Canada", "Hairless / Peach fuzz", 3.5),
            ("Beagle", "Dog", "United Kingdom", "Short, dense", 10.5),
            ("Boxer", "Dog", "Germany", "Short, shiny", 29.0),
            ("Bulldog", "Dog", "United Kingdom", "Short, smooth", 23.0),
            ("Chihuahua", "Dog", "Mexico", "Short or long", 2.2),
            ("Golden Retriever", "Dog", "United Kingdom", "Dense, water-repellent", 32.0),
            ("German Shepherd", "Dog", "Germany", "Medium, double coat", 35.0),
            ("Labrador Retriever", "Dog", "Canada", "Short, dense", 31.0),
            ("Poodle", "Dog", "France / Germany", "Curly, non-shedding", 22.0),
            ("Rottweiler", "Dog", "Germany", "Short, coarse", 45.0),
            ("Siberian Husky", "Dog", "Russia", "Thick double coat", 24.0)
        ]
        cursor.executemany(
            "INSERT INTO dataset_pet_breeds (breed_name, species, origin, fur_type, avg_weight_kg) VALUES (?, ?, ?, ?, ?)",
            pet_records
        )

    # Table: dataset_mnist (Real 1,797 handwritten digits 0-9)
    cursor.execute("SELECT COUNT(*) FROM dataset_mnist")
    if cursor.fetchone()[0] == 0:
        try:
            from sklearn.datasets import load_digits
            digits = load_digits()
            mnist_records = []
            for i in range(len(digits.target)):
                pix_str = ",".join(f"{v:.1f}" for v in digits.data[i])
                split = 'train' if i < 1400 else 'test'
                mnist_records.append((int(digits.target[i]), pix_str, split))
            cursor.executemany("INSERT INTO dataset_mnist (label, pixel_values, split) VALUES (?, ?, ?)", mnist_records)
        except Exception:
            # Fallback if load_digits unavailable
            fallback_mnist = []
            for i in range(100):
                lbl = i % 10
                pix = [round(random.uniform(0, 16), 1) if (j % 10 == lbl) else 0.0 for j in range(64)]
                fallback_mnist.append((lbl, ",".join(map(str, pix)), 'train'))
            cursor.executemany("INSERT INTO dataset_mnist (label, pixel_values, split) VALUES (?, ?, ?)", fallback_mnist)

    # Table: dataset_fashion_mnist (10 clothing classes: 200 samples)
    cursor.execute("SELECT COUNT(*) FROM dataset_fashion_mnist")
    if cursor.fetchone()[0] == 0:
        fashion_classes = [
            (0, 'T-shirt/top'), (1, 'Trouser'), (2, 'Pullover'), (3, 'Dress'),
            (4, 'Coat'), (5, 'Sandal'), (6, 'Shirt'), (7, 'Sneaker'),
            (8, 'Bag'), (9, 'Ankle boot')
        ]
        fashion_records = []
        random.seed(42)
        for class_id, class_name in fashion_classes:
            for rep in range(20):
                # Generate distinctive 64-pixel clothing contour pattern
                grid = [0.0] * 64
                if class_id in (0, 2, 6): # Tops / T-shirt / Pullover
                    for r in range(1, 7):
                        for c in range(1, 7):
                            grid[r*8 + c] = round(random.uniform(8.0, 15.0), 1)
                elif class_id == 1: # Trousers (two vertical columns)
                    for r in range(1, 8):
                        grid[r*8 + 2] = round(random.uniform(10.0, 15.0), 1)
                        grid[r*8 + 5] = round(random.uniform(10.0, 15.0), 1)
                elif class_id == 3: # Dress
                    for r in range(1, 7):
                        width = min(3 + r // 2, 6)
                        for c in range(4 - width//2, 4 + width//2):
                            grid[r*8 + c] = round(random.uniform(7.0, 14.0), 1)
                elif class_id in (5, 7, 9): # Footwear
                    for c in range(1, 7):
                        grid[6*8 + c] = round(random.uniform(12.0, 15.0), 1)
                        grid[7*8 + c] = round(random.uniform(10.0, 14.0), 1)
                else: # Bag / Coat
                    for r in range(2, 7):
                        for c in range(2, 6):
                            grid[r*8 + c] = round(random.uniform(9.0, 15.0), 1)
                pix_str = ",".join(map(str, grid))
                split = 'train' if rep < 16 else 'test'
                fashion_records.append((class_id, class_name, pix_str, split))
        cursor.executemany(
            "INSERT INTO dataset_fashion_mnist (class_id, class_name, pixel_values, split) VALUES (?, ?, ?, ?)",
            fashion_records
        )

    # Table: dataset_cats_vs_dogs (100 samples)
    cursor.execute("SELECT COUNT(*) FROM dataset_cats_vs_dogs")
    if cursor.fetchone()[0] == 0:
        cvd_records = []
        random.seed(42)
        # 50 cats
        for i in range(50):
            r = round(random.uniform(0.4, 0.7), 3)
            g = round(random.uniform(0.3, 0.6), 3)
            b = round(random.uniform(0.3, 0.5), 3)
            ar = round(random.uniform(0.9, 1.1), 2)
            whiskers = round(random.uniform(0.7, 0.98), 2)
            ear_point = round(random.uniform(0.75, 0.99), 2)
            pix = [round(random.uniform(0.1, 0.9), 2) for _ in range(64)]
            cvd_records.append((f"cat_{i+1:03d}", "cat", 0, r, g, b, ar, whiskers, ear_point, ",".join(map(str, pix))))
        # 50 dogs
        for i in range(50):
            r = round(random.uniform(0.5, 0.8), 3)
            g = round(random.uniform(0.4, 0.7), 3)
            b = round(random.uniform(0.2, 0.5), 3)
            ar = round(random.uniform(1.1, 1.45), 2)
            whiskers = round(random.uniform(0.2, 0.5), 2)
            ear_point = round(random.uniform(0.2, 0.6), 2)
            pix = [round(random.uniform(0.1, 0.9), 2) for _ in range(64)]
            cvd_records.append((f"dog_{i+1:03d}", "dog", 1, r, g, b, ar, whiskers, ear_point, ",".join(map(str, pix))))
        cursor.executemany(
            """INSERT INTO dataset_cats_vs_dogs 
               (image_id, label, target, color_r, color_g, color_b, aspect_ratio, whisker_score, ear_pointiness, pixel_values)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            cvd_records
        )

    # Table: dataset_cifar10 (150 samples across 10 classes)
    cursor.execute("SELECT COUNT(*) FROM dataset_cifar10")
    if cursor.fetchone()[0] == 0:
        c10_classes = [
            (0, 'airplane', 0.6, 0.7, 0.8),
            (1, 'automobile', 0.7, 0.2, 0.2),
            (2, 'bird', 0.4, 0.6, 0.3),
            (3, 'cat', 0.6, 0.5, 0.4),
            (4, 'deer', 0.5, 0.4, 0.2),
            (5, 'dog', 0.6, 0.4, 0.3),
            (6, 'frog', 0.2, 0.7, 0.3),
            (7, 'horse', 0.5, 0.3, 0.2),
            (8, 'ship', 0.2, 0.4, 0.7),
            (9, 'truck', 0.4, 0.4, 0.5)
        ]
        c10_records = []
        random.seed(42)
        for class_id, class_name, cr, cg, cb in c10_classes:
            for rep in range(15):
                pix = [round(random.uniform(0.0, 1.0), 2) for _ in range(64)]
                split = 'train' if rep < 12 else 'test'
                c10_records.append((class_id, class_name, cr, cg, cb, ",".join(map(str, pix)), split))
        cursor.executemany(
            "INSERT INTO dataset_cifar10 (class_id, class_name, color_r, color_g, color_b, pixel_values, split) VALUES (?, ?, ?, ?, ?, ?, ?)",
            c10_records
        )

    # Table: dataset_cifar100 (100 classes across 20 superclasses)
    cursor.execute("SELECT COUNT(*) FROM dataset_cifar100")
    if cursor.fetchone()[0] == 0:
        c100_superclasses = {
            'aquatic_mammals': ['beaver', 'dolphin', 'otter', 'seal', 'whale'],
            'fish': ['aquarium_fish', 'flatfish', 'ray', 'shark', 'trout'],
            'flowers': ['orchids', 'poppies', 'roses', 'sunflowers', 'tulips'],
            'food_containers': ['bottles', 'bowls', 'cans', 'cups', 'plates'],
            'fruit_and_vegetables': ['apples', 'mushrooms', 'oranges', 'pears', 'sweet_peppers'],
            'household_electrical': ['clock', 'computer_keyboard', 'lamp', 'telephone', 'television'],
            'household_furniture': ['bed', 'chair', 'couch', 'table', 'wardrobe'],
            'insects': ['bee', 'beetle', 'butterfly', 'caterpillar', 'cockroach'],
            'large_carnivores': ['bear', 'leopard', 'lion', 'tiger', 'wolf'],
            'large_manmade': ['bridge', 'castle', 'house', 'road', 'skyscraper'],
            'large_natural': ['cloud', 'forest', 'mountain', 'plain', 'sea'],
            'large_omnivores': ['camel', 'chimpanzee', 'elephant', 'kangaroo', 'cattle'],
            'medium_mammals': ['fox', 'porcupine', 'possum', 'raccoon', 'skunk'],
            'non_insect_invertebrates': ['crab', 'lobster', 'snail', 'spider', 'worm'],
            'people': ['baby', 'boy', 'girl', 'man', 'woman'],
            'reptiles': ['crocodile', 'dinosaur', 'lizard', 'snake', 'turtle'],
            'small_mammals': ['hamster', 'mouse', 'rabbit', 'shrew', 'squirrel'],
            'trees': ['maple', 'oak', 'palm', 'pine', 'willow'],
            'vehicles_1': ['bicycle', 'bus', 'motorcycle', 'pickup_truck', 'train'],
            'vehicles_2': ['lawn-mower', 'rocket', 'streetcar', 'tank', 'tractor']
        }
        c100_records = []
        cls_counter = 0
        for superclass, classes in c100_superclasses.items():
            for cname in classes:
                pix = [round(random.uniform(0.0, 1.0), 2) for _ in range(64)]
                c100_records.append((cls_counter, cname, superclass, ",".join(map(str, pix))))
                cls_counter += 1
        cursor.executemany(
            "INSERT INTO dataset_cifar100 (class_id, class_name, superclass, pixel_values) VALUES (?, ?, ?, ?)",
            c100_records
        )

    # Table: dataset_energy_timeseries (168 sequential hourly readings = 1 week)
    cursor.execute("SELECT COUNT(*) FROM dataset_energy_timeseries")
    if cursor.fetchone()[0] == 0:
        energy_records = []
        random.seed(42)
        base_load = 2200.0
        for h in range(168):
            day = h // 24
            hour_of_day = h % 24
            # Circadian cycle: peak at 14:00 (hour 14) and 20:00, trough at 04:00
            diurnal = math.sin((hour_of_day - 6) / 24.0 * 2 * math.pi) * 650.0
            weekend_factor = 0.85 if day in (5, 6) else 1.0
            noise = random.uniform(-45.0, 45.0)
            demand = round((base_load + diurnal) * weekend_factor + noise, 1)
            pct = round((demand / 3500.0) * 100.0, 1)
            status = 'peak' if pct > 80.0 else ('off-peak' if pct < 50.0 else 'normal')
            timestamp = f"2024-10-{(day+1):02d} {hour_of_day:02d}:00"
            energy_records.append((timestamp, demand, pct, status))
        cursor.executemany(
            "INSERT INTO dataset_energy_timeseries (timestamp, megawatts_demand, grid_load_pct, status) VALUES (?, ?, ?, ?)",
            energy_records
        )

    # Table: dataset_emnist (124 character vectors: A-Z, a-z, 0-9)
    cursor.execute("SELECT COUNT(*) FROM dataset_emnist")
    if cursor.fetchone()[0] == 0:
        emnist_records = []
        chars = (
            [(chr(c), 'uppercase', c - 65) for c in range(65, 91)] +
            [(chr(c), 'lowercase', c - 97 + 26) for c in range(97, 123)] +
            [(str(d), 'digit', d + 52) for d in range(10)]
        )
        random.seed(42)
        for ch, cat, lid in chars:
            for rep in range(2):
                pix = [round(random.uniform(0.0, 16.0), 1) if (random.random() > 0.6) else 0.0 for _ in range(64)]
                emnist_records.append((ch, cat, lid, ",".join(map(str, pix))))
        cursor.executemany(
            "INSERT INTO dataset_emnist (character, category, label_id, pixel_values) VALUES (?, ?, ?, ?)",
            emnist_records
        )

    # Table: dataset_kmnist (10 Japanese Hiragana classes: 100 samples)
    cursor.execute("SELECT COUNT(*) FROM dataset_kmnist")
    if cursor.fetchone()[0] == 0:
        kmnist_classes = [
            ('o', 'お', 0), ('ki', 'き', 1), ('su', 'す', 2), ('tsu', 'つ', 3),
            ('na', 'な', 4), ('ha', 'は', 5), ('ma', 'ま', 6), ('ya', 'や', 7),
            ('re', 'れ', 8), ('wo', 'を', 9)
        ]
        kmnist_records = []
        random.seed(42)
        for cname, hchar, lid in kmnist_classes:
            for _ in range(10):
                pix = [round(random.uniform(0.0, 16.0), 1) if (random.random() > 0.55) else 0.0 for _ in range(64)]
                kmnist_records.append((cname, hchar, lid, ",".join(map(str, pix))))
        cursor.executemany(
            "INSERT INTO dataset_kmnist (character_name, hiragana_char, label_id, pixel_values) VALUES (?, ?, ?, ?)",
            kmnist_records
        )

    # Table: dataset_celeba (100 face records)
    cursor.execute("SELECT COUNT(*) FROM dataset_celeba")
    if cursor.fetchone()[0] == 0:
        celeba_records = []
        random.seed(42)
        for i in range(1, 101):
            male = 1 if (i % 2 == 0) else 0
            young = 1 if (i % 3 != 0) else 0
            smiling = 1 if (i % 2 != 0 or i % 5 == 0) else 0
            glasses = 1 if (i % 7 == 0) else 0
            blonde = 1 if (i % 6 == 0) else 0
            makeup = 1 if (male == 0 and i % 3 == 0) else 0
            feat = [round(random.gauss(0.0, 1.0), 3) for _ in range(32)]
            celeba_records.append((f"{i:06d}.jpg", male, young, smiling, glasses, blonde, makeup, ",".join(map(str, feat))))
        cursor.executemany(
            """INSERT INTO dataset_celeba (image_id, male, young, smiling, eyeglasses, blonde_hair, heavy_makeup, feature_vector)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            celeba_records
        )

    # Table: dataset_stl10 (100 samples across 10 classes)
    cursor.execute("SELECT COUNT(*) FROM dataset_stl10")
    if cursor.fetchone()[0] == 0:
        stl_classes = [
            (0, 'airplane', 0.6, 0.7, 0.8), (1, 'bird', 0.4, 0.6, 0.3),
            (2, 'car', 0.8, 0.2, 0.2), (3, 'cat', 0.6, 0.5, 0.4),
            (4, 'deer', 0.5, 0.4, 0.2), (5, 'dog', 0.6, 0.4, 0.3),
            (6, 'horse', 0.5, 0.3, 0.2), (7, 'monkey', 0.5, 0.4, 0.3),
            (8, 'ship', 0.2, 0.4, 0.7), (9, 'truck', 0.4, 0.4, 0.5)
        ]
        stl_records = []
        random.seed(42)
        for cid, cname, cr, cg, cb in stl_classes:
            for rep in range(10):
                pix = [round(random.uniform(0.0, 1.0), 2) for _ in range(64)]
                split = 'train' if rep < 8 else 'test'
                stl_records.append((cid, cname, cr, cg, cb, ",".join(map(str, pix)), split))
        cursor.executemany(
            "INSERT INTO dataset_stl10 (class_id, class_name, color_r, color_g, color_b, pixel_values, split) VALUES (?, ?, ?, ?, ?, ?, ?)",
            stl_records
        )

    # Table: dataset_imagenet_samples (25 architecture benchmarks & classes)
    cursor.execute("SELECT COUNT(*) FROM dataset_imagenet_samples")
    if cursor.fetchone()[0] == 0:
        imagenet_data = [
            ("n01440764", "tench", "ResNet-50", 76.1, 92.9, 25.6, 2048, "0.12,0.45,-0.22,0.89"),
            ("n01443537", "goldfish", "ResNet-50", 76.1, 92.9, 25.6, 2048, "0.33,0.11,-0.05,0.78"),
            ("n01484850", "great_white_shark", "ResNet-50", 76.1, 92.9, 25.6, 2048, "-0.15,0.82,0.41,0.22"),
            ("n01491361", "tiger_shark", "VGG-16", 71.3, 90.1, 138.4, 4096, "0.08,0.67,0.35,0.19"),
            ("n01494475", "hammerhead", "VGG-16", 71.3, 90.1, 138.4, 4096, "-0.04,0.72,0.29,0.31"),
            ("n01496331", "electric_ray", "VGG-16", 71.3, 90.1, 138.4, 4096, "0.19,0.38,-0.12,0.55"),
            ("n01498041", "stingray", "MobileNet-V2", 72.0, 91.0, 3.5, 1280, "0.22,0.41,-0.08,0.61"),
            ("n01514668", "cock", "MobileNet-V2", 72.0, 91.0, 3.5, 1280, "0.51,0.28,0.14,0.42"),
            ("n01514859", "hen", "MobileNet-V2", 72.0, 91.0, 3.5, 1280, "0.48,0.31,0.11,0.39"),
            ("n01518210", "ostrich", "EfficientNet-B0", 77.1, 93.3, 5.3, 1280, "-0.09,0.55,0.62,0.33"),
            ("n01531178", "brambling", "EfficientNet-B0", 77.1, 93.3, 5.3, 1280, "0.38,0.44,-0.02,0.52"),
            ("n01532829", "goldfinch", "EfficientNet-B0", 77.1, 93.3, 5.3, 1280, "0.42,0.49,-0.05,0.58"),
            ("n01534433", "house_finch", "DenseNet-121", 75.0, 92.3, 8.0, 1024, "0.35,0.41,0.02,0.49"),
            ("n01537544", "indigo_bunting", "DenseNet-121", 75.0, 92.3, 8.0, 1024, "0.18,0.62,0.22,0.65"),
            ("n01558993", "robin", "DenseNet-121", 75.0, 92.3, 8.0, 1024, "0.45,0.38,0.12,0.44"),
            ("n01560419", "bulbul", "Inception-V3", 78.8, 94.4, 23.8, 2048, "0.39,0.42,0.08,0.51"),
            ("n01580077", "jay", "Inception-V3", 78.8, 94.4, 23.8, 2048, "0.25,0.58,0.19,0.62"),
            ("n01582220", "magpie", "Inception-V3", 78.8, 94.4, 23.8, 2048, "-0.02,0.75,0.31,0.48"),
            ("n01592084", "chickadee", "ResNet-50", 76.1, 92.9, 25.6, 2048, "0.29,0.47,0.05,0.53"),
            ("n01608432", "kite", "ResNet-50", 76.1, 92.9, 25.6, 2048, "-0.11,0.68,0.45,0.38"),
            ("n01614925", "bald_eagle", "ResNet-50", 76.1, 92.9, 25.6, 2048, "-0.18,0.85,0.52,0.41"),
            ("n01616318", "vulture", "VGG-16", 71.3, 90.1, 138.4, 4096, "-0.22,0.79,0.48,0.35"),
            ("n01622779", "great_grey_owl", "VGG-16", 71.3, 90.1, 138.4, 4096, "0.05,0.62,0.38,0.52"),
            ("n02123045", "tabby_cat", "MobileNet-V2", 72.0, 91.0, 3.5, 1280, "0.55,0.42,0.21,0.68"),
            ("n02099712", "labrador_retriever", "MobileNet-V2", 72.0, 91.0, 3.5, 1280, "0.62,0.38,0.18,0.72")
        ]
        cursor.executemany(
            """INSERT INTO dataset_imagenet_samples 
               (synset_id, class_name, model_name, top_1_accuracy, top_5_accuracy, params_millions, feature_dimensions, sample_feature_vector)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            imagenet_data
        )

    # Table: dataset_caltech101 (35 categories)
    cursor.execute("SELECT COUNT(*) FROM dataset_caltech101")
    if cursor.fetchone()[0] == 0:
        caltech_data = [
            ("accordion", 55, 1.25, "HOG_0.42_SIFT_0.78"),
            ("airplanes", 800, 1.55, "HOG_0.68_SIFT_0.85"),
            ("anchor", 42, 0.85, "HOG_0.35_SIFT_0.52"),
            ("ant", 42, 1.40, "HOG_0.29_SIFT_0.48"),
            ("barrel", 47, 0.95, "HOG_0.41_SIFT_0.59"),
            ("bass", 54, 1.60, "HOG_0.52_SIFT_0.64"),
            ("beaver", 46, 1.35, "HOG_0.48_SIFT_0.61"),
            ("binocular", 33, 1.15, "HOG_0.38_SIFT_0.55"),
            ("bonsai", 128, 0.90, "HOG_0.45_SIFT_0.72"),
            ("brain", 98, 1.10, "HOG_0.62_SIFT_0.81"),
            ("brontosaurus", 43, 1.70, "HOG_0.55_SIFT_0.68"),
            ("buddha", 85, 0.80, "HOG_0.49_SIFT_0.74"),
            ("butterfly", 91, 1.20, "HOG_0.58_SIFT_0.79"),
            ("camera", 50, 1.30, "HOG_0.44_SIFT_0.65"),
            ("cannon", 43, 1.45, "HOG_0.39_SIFT_0.58"),
            ("car_side", 123, 1.65, "HOG_0.72_SIFT_0.88"),
            ("ceiling_fan", 47, 1.05, "HOG_0.36_SIFT_0.51"),
            ("cellphone", 59, 0.65, "HOG_0.43_SIFT_0.62"),
            ("chair", 62, 0.85, "HOG_0.46_SIFT_0.67"),
            ("chandelier", 107, 0.95, "HOG_0.51_SIFT_0.76"),
            ("cougar_body", 47, 1.50, "HOG_0.54_SIFT_0.70"),
            ("cougar_face", 69, 1.05, "HOG_0.61_SIFT_0.82"),
            ("crab", 73, 1.35, "HOG_0.47_SIFT_0.66"),
            ("crayfish", 49, 1.40, "HOG_0.42_SIFT_0.60"),
            ("crocodile", 50, 1.80, "HOG_0.56_SIFT_0.71"),
            ("cup", 57, 1.10, "HOG_0.38_SIFT_0.54"),
            ("dalmatian", 67, 1.30, "HOG_0.59_SIFT_0.78"),
            ("dollar_bill", 52, 1.75, "HOG_0.65_SIFT_0.84"),
            ("dolphin", 65, 1.55, "HOG_0.53_SIFT_0.69"),
            ("dragonfly", 68, 1.25, "HOG_0.49_SIFT_0.73"),
            ("electric_guitar", 75, 0.55, "HOG_0.57_SIFT_0.77"),
            ("elephant", 64, 1.40, "HOG_0.63_SIFT_0.83"),
            ("emu", 53, 0.90, "HOG_0.44_SIFT_0.63"),
            ("euphonium", 64, 0.75, "HOG_0.48_SIFT_0.68"),
            ("ewer", 85, 0.85, "HOG_0.41_SIFT_0.59")
        ]
        cursor.executemany(
            "INSERT INTO dataset_caltech101 (category_name, samples_count, avg_aspect_ratio, feature_descriptor) VALUES (?, ?, ?, ?)",
            caltech_data
        )

    # Table: dataset_coco_detection (40 bounding boxes)
    cursor.execute("SELECT COUNT(*) FROM dataset_coco_detection")
    if cursor.fetchone()[0] == 0:
        coco_boxes = [
            ("000000000139.jpg", "person", 1, 120.5, 85.0, 140.0, 320.0, 44800.0),
            ("000000000139.jpg", "bicycle", 2, 85.0, 210.0, 205.0, 180.0, 36900.0),
            ("000000000285.jpg", "car", 3, 210.0, 140.0, 280.0, 150.0, 42000.0),
            ("000000000285.jpg", "car", 3, 490.0, 155.0, 120.0, 95.0, 11400.0),
            ("000000000632.jpg", "motorcycle", 4, 150.0, 120.0, 210.0, 240.0, 50400.0),
            ("000000000724.jpg", "airplane", 5, 50.0, 80.0, 540.0, 210.0, 113400.0),
            ("000000000785.jpg", "bus", 6, 80.0, 90.0, 420.0, 280.0, 117600.0),
            ("000000000802.jpg", "train", 7, 30.0, 60.0, 580.0, 310.0, 179800.0),
            ("000000000872.jpg", "truck", 8, 110.0, 100.0, 350.0, 220.0, 77000.0),
            ("000000000885.jpg", "boat", 9, 140.0, 180.0, 290.0, 140.0, 40600.0),
            ("000000001000.jpg", "traffic light", 10, 450.0, 40.0, 35.0, 85.0, 2975.0),
            ("000000001000.jpg", "car", 3, 180.0, 220.0, 240.0, 130.0, 31200.0),
            ("000000001268.jpg", "fire hydrant", 11, 280.0, 310.0, 65.0, 110.0, 7150.0),
            ("000000001296.jpg", "stop sign", 13, 310.0, 75.0, 85.0, 85.0, 7225.0),
            ("000000001353.jpg", "bench", 15, 160.0, 250.0, 280.0, 120.0, 33600.0),
            ("000000001422.jpg", "bird", 16, 210.0, 180.0, 95.0, 75.0, 7125.0),
            ("000000001442.jpg", "cat", 17, 190.0, 140.0, 180.0, 210.0, 37800.0),
            ("000000001503.jpg", "dog", 18, 140.0, 160.0, 220.0, 190.0, 41800.0),
            ("000000001532.jpg", "horse", 19, 90.0, 110.0, 340.0, 280.0, 95200.0),
            ("000000001600.jpg", "sheep", 20, 180.0, 210.0, 140.0, 110.0, 15400.0),
            ("000000001600.jpg", "sheep", 20, 340.0, 220.0, 135.0, 105.0, 14175.0),
            ("000000001765.jpg", "cow", 21, 120.0, 130.0, 290.0, 220.0, 63800.0),
            ("000000001818.jpg", "elephant", 22, 100.0, 90.0, 410.0, 320.0, 131200.0),
            ("000000001920.jpg", "backpack", 27, 210.0, 150.0, 85.0, 120.0, 10200.0),
            ("000000001920.jpg", "person", 1, 180.0, 90.0, 160.0, 360.0, 57600.0),
            ("000000002010.jpg", "umbrella", 28, 150.0, 40.0, 220.0, 140.0, 30800.0),
            ("000000002144.jpg", "handbag", 31, 240.0, 220.0, 70.0, 85.0, 5950.0),
            ("000000002200.jpg", "tie", 32, 280.0, 180.0, 30.0, 120.0, 3600.0),
            ("000000002315.jpg", "suitcase", 33, 110.0, 260.0, 140.0, 180.0, 25200.0),
            ("000000002400.jpg", "sports ball", 37, 310.0, 290.0, 45.0, 45.0, 2025.0),
            ("000000002520.jpg", "baseball bat", 39, 210.0, 140.0, 35.0, 180.0, 6300.0),
            ("000000002610.jpg", "skateboard", 41, 180.0, 340.0, 180.0, 55.0, 9900.0),
            ("000000002700.jpg", "surfboard", 42, 80.0, 120.0, 320.0, 80.0, 25600.0),
            ("000000002812.jpg", "tennis racket", 43, 260.0, 110.0, 90.0, 160.0, 14400.0),
            ("000000002930.jpg", "bottle", 44, 285.0, 175.0, 40.0, 120.0, 4800.0),
            ("000000003010.jpg", "wine glass", 46, 210.0, 190.0, 45.0, 95.0, 4275.0),
            ("000000003120.jpg", "cup", 47, 180.0, 220.0, 55.0, 60.0, 3300.0),
            ("000000003250.jpg", "fork", 48, 140.0, 240.0, 25.0, 90.0, 2250.0),
            ("000000003340.jpg", "knife", 49, 310.0, 235.0, 20.0, 110.0, 2200.0),
            ("000000003410.jpg", "spoon", 50, 260.0, 245.0, 30.0, 85.0, 2550.0)
        ]
        cursor.executemany(
            """INSERT INTO dataset_coco_detection (image_id, category_name, category_id, bbox_x, bbox_y, bbox_width, bbox_height, area)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            coco_boxes
        )

    # Table: dataset_pascal_voc (35 ground truth boxes)
    cursor.execute("SELECT COUNT(*) FROM dataset_pascal_voc")
    if cursor.fetchone()[0] == 0:
        voc_boxes = [
            ("000032.jpg", "aeroplane", 104, 78, 375, 183, 0),
            ("000032.jpg", "aeroplane", 133, 88, 197, 123, 0),
            ("000033.jpg", "aeroplane", 9, 107, 499, 263, 0),
            ("000034.jpg", "bicycle", 145, 120, 380, 410, 0),
            ("000035.jpg", "bird", 180, 80, 340, 320, 0),
            ("000036.jpg", "boat", 50, 140, 450, 310, 0),
            ("000039.jpg", "bottle", 156, 89, 344, 479, 0),
            ("000042.jpg", "bus", 80, 110, 410, 330, 0),
            ("000044.jpg", "car", 120, 180, 390, 310, 0),
            ("000047.jpg", "car", 15, 120, 280, 320, 0),
            ("000048.jpg", "cat", 130, 110, 360, 410, 0),
            ("000050.jpg", "chair", 85, 190, 220, 390, 0),
            ("000052.jpg", "cow", 60, 140, 410, 330, 0),
            ("000054.jpg", "diningtable", 110, 210, 430, 420, 0),
            ("000060.jpg", "dog", 140, 120, 380, 380, 0),
            ("000064.jpg", "horse", 90, 85, 410, 390, 0),
            ("000066.jpg", "motorbike", 110, 130, 370, 390, 0),
            ("000073.jpg", "person", 121, 65, 290, 450, 0),
            ("000073.jpg", "person", 280, 110, 430, 420, 0),
            ("000078.jpg", "pottedplant", 140, 190, 260, 380, 0),
            ("000083.jpg", "sheep", 110, 150, 350, 340, 0),
            ("000085.jpg", "sofa", 90, 180, 420, 370, 0),
            ("000089.jpg", "train", 40, 95, 460, 340, 0),
            ("000091.jpg", "tvmonitor", 120, 110, 380, 310, 0),
            ("000093.jpg", "person", 150, 90, 270, 410, 0),
            ("000093.jpg", "bicycle", 130, 220, 340, 420, 0),
            ("000099.jpg", "car", 50, 140, 290, 290, 0),
            ("000099.jpg", "car", 270, 150, 460, 300, 0),
            ("000101.jpg", "person", 180, 80, 310, 390, 0),
            ("000102.jpg", "dog", 160, 140, 340, 360, 0),
            ("000105.jpg", "horse", 100, 90, 390, 370, 0),
            ("000107.jpg", "cat", 140, 130, 350, 370, 0),
            ("000110.jpg", "bus", 70, 100, 430, 320, 0),
            ("000112.jpg", "aeroplane", 30, 120, 470, 280, 0),
            ("000115.jpg", "boat", 90, 160, 410, 310, 0)
        ]
        cursor.executemany(
            "INSERT INTO dataset_pascal_voc (image_name, class_name, xmin, ymin, xmax, ymax, difficult) VALUES (?, ?, ?, ?, ?, ?, ?)",
            voc_boxes
        )

    # Table: dataset_open_images (30 normalized boxes)
    cursor.execute("SELECT COUNT(*) FROM dataset_open_images")
    if cursor.fetchone()[0] == 0:
        open_img_data = [
            ("000a123f8b.jpg", "Person", 0.95, 0.22, 0.48, 0.15, 0.85),
            ("000a123f8b.jpg", "Clothing", 0.89, 0.24, 0.46, 0.35, 0.75),
            ("001b456c9d.jpg", "Car", 0.98, 0.35, 0.82, 0.40, 0.78),
            ("001b456c9d.jpg", "Wheel", 0.91, 0.40, 0.52, 0.65, 0.78),
            ("001b456c9d.jpg", "Wheel", 0.88, 0.68, 0.80, 0.66, 0.79),
            ("002c789e0f.jpg", "Tree", 0.92, 0.05, 0.35, 0.10, 0.90),
            ("002c789e0f.jpg", "Building", 0.87, 0.40, 0.95, 0.12, 0.88),
            ("003d012a1b.jpg", "Window", 0.94, 0.45, 0.60, 0.25, 0.45),
            ("003d012a1b.jpg", "Door", 0.85, 0.65, 0.85, 0.50, 0.92),
            ("004e345b2c.jpg", "Animal", 0.96, 0.28, 0.72, 0.32, 0.84),
            ("005f678c3d.jpg", "Land vehicle", 0.97, 0.18, 0.85, 0.28, 0.74),
            ("006a901d4e.jpg", "Person", 0.93, 0.12, 0.32, 0.18, 0.79),
            ("006a901d4e.jpg", "Person", 0.90, 0.45, 0.68, 0.22, 0.81),
            ("007b234e5f.jpg", "Car", 0.96, 0.25, 0.75, 0.35, 0.72),
            ("008c567f6a.jpg", "Tree", 0.89, 0.62, 0.92, 0.15, 0.88),
            ("009d890a7b.jpg", "Clothing", 0.91, 0.30, 0.55, 0.38, 0.76),
            ("010e123b8c.jpg", "Building", 0.94, 0.10, 0.55, 0.08, 0.85),
            ("011f456c9d.jpg", "Person", 0.88, 0.58, 0.78, 0.25, 0.82),
            ("012a789d0e.jpg", "Wheel", 0.86, 0.28, 0.42, 0.60, 0.74),
            ("013b012e1f.jpg", "Animal", 0.94, 0.35, 0.68, 0.40, 0.82),
            ("014c345f2a.jpg", "Door", 0.89, 0.22, 0.42, 0.48, 0.90),
            ("015d678a3b.jpg", "Window", 0.92, 0.62, 0.78, 0.30, 0.52),
            ("016e901b4c.jpg", "Land vehicle", 0.98, 0.15, 0.88, 0.32, 0.78),
            ("017f234c5d.jpg", "Person", 0.91, 0.38, 0.58, 0.20, 0.75),
            ("018a567d6e.jpg", "Clothing", 0.87, 0.40, 0.55, 0.38, 0.72),
            ("019b890e7f.jpg", "Car", 0.95, 0.20, 0.70, 0.42, 0.80),
            ("020c123f8a.jpg", "Tree", 0.90, 0.08, 0.42, 0.18, 0.92),
            ("021d456a9b.jpg", "Building", 0.93, 0.52, 0.95, 0.15, 0.89),
            ("022e789b0c.jpg", "Animal", 0.96, 0.22, 0.65, 0.35, 0.78),
            ("023f012c1d.jpg", "Person", 0.94, 0.45, 0.68, 0.19, 0.82)
        ]
        cursor.executemany(
            "INSERT INTO dataset_open_images (image_id, label_name, confidence, x_min, x_max, y_min, y_max) VALUES (?, ?, ?, ?, ?, ?, ?)",
            open_img_data
        )

    # Table: dataset_kitti_detection (30 autonomous driving detections)
    cursor.execute("SELECT COUNT(*) FROM dataset_kitti_detection")
    if cursor.fetchone()[0] == 0:
        kitti_data = [
            ("000000", "Pedestrian", 0.0, 0, 712.4, 143.0, 810.7, 307.9, 18.5),
            ("000001", "Truck", 0.0, 0, 580.2, 125.4, 730.0, 280.1, 24.8),
            ("000001", "Car", 0.1, 1, 210.5, 160.2, 380.0, 260.4, 15.2),
            ("000002", "Car", 0.0, 0, 640.0, 170.0, 850.5, 290.0, 11.4),
            ("000003", "Cyclist", 0.0, 0, 480.1, 155.0, 560.8, 295.2, 21.0),
            ("000004", "Van", 0.0, 0, 310.4, 130.5, 520.1, 270.8, 19.3),
            ("000004", "Car", 0.0, 0, 680.0, 180.2, 890.4, 305.1, 9.8),
            ("000005", "Pedestrian", 0.2, 1, 520.0, 140.0, 580.0, 275.0, 28.4),
            ("000006", "Car", 0.0, 0, 410.2, 165.4, 610.8, 285.0, 14.7),
            ("000007", "Car", 0.0, 0, 180.0, 175.0, 390.5, 295.2, 12.1),
            ("000008", "Truck", 0.0, 0, 550.0, 110.0, 780.0, 290.0, 22.5),
            ("000009", "Cyclist", 0.0, 0, 390.5, 160.0, 470.2, 290.4, 19.8),
            ("000010", "Car", 0.0, 0, 620.4, 170.2, 820.0, 285.4, 13.5),
            ("000011", "Van", 0.0, 0, 280.0, 140.0, 460.5, 265.0, 17.9),
            ("000012", "Pedestrian", 0.0, 0, 490.2, 150.4, 555.0, 280.1, 23.2),
            ("000013", "Car", 0.1, 0, 650.0, 175.0, 880.0, 300.0, 10.5),
            ("000014", "Truck", 0.0, 0, 510.0, 120.0, 740.0, 285.0, 26.1),
            ("000015", "Car", 0.0, 0, 320.5, 168.0, 510.2, 278.4, 16.3),
            ("000016", "Cyclist", 0.0, 0, 420.0, 155.0, 505.0, 285.0, 20.4),
            ("000017", "Car", 0.0, 0, 580.0, 172.0, 790.0, 292.0, 12.8),
            ("000018", "Pedestrian", 0.0, 0, 680.5, 145.0, 745.0, 270.0, 22.0),
            ("000019", "Car", 0.0, 0, 250.0, 170.0, 440.0, 280.0, 14.2),
            ("000020", "Van", 0.0, 0, 480.0, 135.0, 690.0, 275.0, 20.8),
            ("000021", "Car", 0.0, 0, 640.2, 174.0, 860.0, 298.0, 11.2),
            ("000022", "Truck", 0.0, 0, 560.0, 115.0, 795.0, 288.0, 23.9),
            ("000023", "Cyclist", 0.0, 0, 370.0, 162.0, 455.0, 292.0, 18.7),
            ("000024", "Pedestrian", 0.0, 0, 530.0, 148.0, 595.0, 276.0, 25.0),
            ("000025", "Car", 0.0, 0, 340.0, 166.0, 530.0, 282.0, 15.6),
            ("000026", "Car", 0.0, 0, 610.0, 171.0, 815.0, 289.0, 13.0),
            ("000027", "Van", 0.0, 0, 290.0, 138.0, 475.0, 268.0, 17.5)
        ]
        cursor.executemany(
            """INSERT INTO dataset_kitti_detection 
               (frame_id, object_type, truncated, occluded, bbox_left, bbox_top, bbox_right, bbox_bottom, distance_meters)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            kitti_data
        )

    # Table: dataset_custom_detection (25 normalized YOLO format annotations)
    cursor.execute("SELECT COUNT(*) FROM dataset_custom_detection")
    if cursor.fetchone()[0] == 0:
        yolo_custom = [
            ("img_001.jpg", 0, "person", 0.452, 0.584, 0.185, 0.620, 1.0),
            ("img_001.jpg", 2, "backpack", 0.420, 0.510, 0.110, 0.220, 1.0),
            ("img_002.jpg", 1, "bicycle", 0.612, 0.720, 0.280, 0.350, 1.0),
            ("img_003.jpg", 3, "car", 0.520, 0.610, 0.420, 0.280, 1.0),
            ("img_003.jpg", 3, "car", 0.810, 0.590, 0.220, 0.210, 1.0),
            ("img_004.jpg", 0, "person", 0.310, 0.480, 0.140, 0.550, 1.0),
            ("img_004.jpg", 0, "person", 0.680, 0.520, 0.155, 0.570, 1.0),
            ("img_005.jpg", 4, "traffic_light", 0.820, 0.210, 0.055, 0.140, 1.0),
            ("img_006.jpg", 5, "dog", 0.480, 0.710, 0.250, 0.310, 1.0),
            ("img_007.jpg", 6, "cat", 0.510, 0.650, 0.220, 0.280, 1.0),
            ("img_008.jpg", 3, "car", 0.350, 0.640, 0.380, 0.290, 1.0),
            ("img_009.jpg", 7, "motorcycle", 0.560, 0.680, 0.240, 0.390, 1.0),
            ("img_010.jpg", 8, "bus", 0.490, 0.520, 0.620, 0.480, 1.0),
            ("img_011.jpg", 9, "truck", 0.540, 0.550, 0.580, 0.420, 1.0),
            ("img_012.jpg", 0, "person", 0.410, 0.590, 0.160, 0.640, 1.0),
            ("img_013.jpg", 1, "bicycle", 0.440, 0.740, 0.260, 0.360, 1.0),
            ("img_014.jpg", 4, "traffic_light", 0.210, 0.250, 0.048, 0.135, 1.0),
            ("img_015.jpg", 3, "car", 0.580, 0.620, 0.390, 0.270, 1.0),
            ("img_016.jpg", 0, "person", 0.490, 0.510, 0.150, 0.580, 1.0),
            ("img_017.jpg", 5, "dog", 0.380, 0.730, 0.230, 0.290, 1.0),
            ("img_018.jpg", 6, "cat", 0.620, 0.690, 0.210, 0.270, 1.0),
            ("img_019.jpg", 8, "bus", 0.510, 0.540, 0.650, 0.460, 1.0),
            ("img_020.jpg", 9, "truck", 0.470, 0.580, 0.540, 0.390, 1.0),
            ("img_021.jpg", 7, "motorcycle", 0.420, 0.660, 0.230, 0.370, 1.0),
            ("img_022.jpg", 3, "car", 0.690, 0.610, 0.360, 0.260, 1.0)
        ]
        cursor.executemany(
            """INSERT INTO dataset_custom_detection 
               (image_filename, class_id, class_label, x_center, y_center, width, height, confidence)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            yolo_custom
        )

    conn.commit()
