import React, { useState, useEffect } from 'react';
import { Search, Database, Plus, Copy, Check } from 'lucide-react';
import './datase.css';

export interface LabDataset {
  id: string;
  name: string;
  lab_number?: number;
  experiment_title?: string;
  category: string;
  category_label?: string;
  categoryLabel?: string;
  samples_count?: string;
  rows?: string;
  features_info?: string;
  features?: string;
  description: string;
  loader_code?: string;
  codeSnippet?: string;
  table_name?: string | null;
}

export const LAB_DATASETS: LabDataset[] = [
  // Lab 6: Gradient descent and backpropagation
  {
    id: 'synthetic_classification',
    name: 'Synthetic Classification Data',
    lab_number: 6,
    experiment_title: 'Gradient descent and backpropagation',
    category: 'classification',
    category_label: 'Classification',
    samples_count: '150 samples',
    features_info: '4 continuous features, 2 classes',
    description: 'Multi-feature synthetic dataset in SQLite for linear and logistic gradient descent optimization benchmarks.',
    loader_code: `import sqlite3
import pandas as pd

# Load from local PyShield SQLite Database
conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT feature_1, feature_2, feature_3, feature_4, target FROM dataset_synthetic_classification", conn)
print(f"Loaded Synthetic Data from SQLite: {df.shape}")
print(df.head())`,
    table_name: 'dataset_synthetic_classification'
  },
  {
    id: 'iris_flower',
    name: 'Iris Flower Dataset',
    lab_number: 6,
    experiment_title: 'Gradient descent and backpropagation',
    category: 'classification',
    category_label: 'Classification',
    samples_count: '150 samples',
    features_info: '4 features (sepal/petal), 3 species',
    description: 'Classic 3-class flower dataset (Setosa, Versicolour, Virginica) stored in SQLite for multi-class gradient descent & softmax regression.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT sepal_length, sepal_width, petal_length, petal_width, species FROM dataset_iris", conn)
print("Iris Shape from SQLite:", df.shape)
print(df.head())`,
    table_name: 'dataset_iris'
  },
  {
    id: 'mnist_gradient',
    name: 'MNIST Handwritten Digits',
    lab_number: 6,
    experiment_title: 'Gradient descent and backpropagation',
    category: 'vision',
    category_label: 'Vision (0-9)',
    samples_count: '1,797 images',
    features_info: '8x8 grayscale pixel matrices in SQLite',
    description: 'Normalized 8x8 handwritten digits (0-9) stored directly in SQLite for multi-layer perceptron training and backpropagation algorithms.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_mnist'
  },
  {
    id: 'fashion_mnist_sample',
    name: 'Fashion-MNIST Benchmark',
    lab_number: 6,
    experiment_title: 'Gradient descent and backpropagation',
    category: 'vision',
    category_label: 'Vision (10 classes)',
    samples_count: '200 samples',
    features_info: '8x8 grayscale clothing vectors in SQLite',
    description: 'Zalando article images (T-shirt, Trouser, Pullover, Dress, Coat, Sandal, Shirt, Sneaker, Bag, Ankle boot) stored in SQLite for gradient descent.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_fashion_mnist'
  },

  // Lab 7: CNN for cat and dog classification
  {
    id: 'cats_vs_dogs',
    name: 'Cats vs Dogs Dataset',
    lab_number: 7,
    experiment_title: 'CNN for cat and dog classification',
    category: 'vision',
    category_label: 'Binary Vision',
    samples_count: '100 samples',
    features_info: 'Image features & pixel matrices in SQLite',
    description: 'Standard benchmark for convolutional neural networks separating feline and canine image samples stored in SQLite.',
    loader_code: `import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label, target, color_r, color_g, color_b, ear_pointiness, whisker_score FROM dataset_cats_vs_dogs", conn)
print("Cats vs Dogs from SQLite Shape:", df.shape)
print("Class counts:\\n", df['label'].value_counts())
print(df.head())`,
    table_name: 'dataset_cats_vs_dogs'
  },
  {
    id: 'oxford_iiit_pet',
    name: 'Oxford-IIIT Pet Breeds',
    lab_number: 7,
    experiment_title: 'CNN for cat and dog classification',
    category: 'vision',
    category_label: 'Fine-Grained Pet Breeds',
    samples_count: '37 breeds',
    features_info: 'Breed metadata, species, weight, fur type',
    description: 'Fine-grained 37 category pet dataset with breed classifications, physical attributes, and species tags in SQLite.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, origin, fur_type, avg_weight_kg FROM dataset_pet_breeds", conn)
print("Pet Breeds Shape from SQLite:", df.shape)
print(df.head(10))`,
    table_name: 'dataset_pet_breeds'
  },
  {
    id: 'cifar10',
    name: 'CIFAR-10 Object Sample',
    lab_number: 7,
    experiment_title: 'CNN for cat and dog classification',
    category: 'vision',
    category_label: 'Vision (10 classes)',
    samples_count: '150 samples (10 classes)',
    features_info: 'Color image features in SQLite',
    description: 'Classic vision benchmark: airplane, automobile, bird, cat, deer, dog, frog, horse, ship, and truck stored in SQLite.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 from SQLite:", df.shape)
print("Classes:", df['class_name'].unique().tolist())
print(df.head(10))`,
    table_name: 'dataset_cifar10'
  },
  {
    id: 'cifar100',
    name: 'CIFAR-100 Fine-Grained Objects',
    lab_number: 7,
    experiment_title: 'CNN for cat and dog classification',
    category: 'vision',
    category_label: 'Vision (100 classes)',
    samples_count: '100 classes, 20 superclasses',
    features_info: 'Hierarchical object classes in SQLite',
    description: '100 fine-grained classes grouped into 20 superclasses (aquatic mammals, fish, flowers, trees, vehicles, etc.) stored in SQLite.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, superclass FROM dataset_cifar100", conn)
print("CIFAR-100 from SQLite:", len(df), "classes across", df['superclass'].nunique(), "superclasses")
print(df.head(10))`,
    table_name: 'dataset_cifar100'
  },

  // Lab 8: LSTM
  {
    id: 'airline_passengers',
    name: 'Airline Passenger Time Series',
    lab_number: 8,
    experiment_title: 'LSTM',
    category: 'time-series',
    category_label: 'Time Series (144 months)',
    samples_count: '144 months (1949-1960)',
    features_info: 'Monthly airline passenger volume in SQLite',
    description: 'The definitive Box-Jenkins monthly international airline passengers time series for LSTM sequence forecasting.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_airline_passengers'
  },
  {
    id: 'daily_weather',
    name: 'Daily Weather Time Series',
    lab_number: 8,
    experiment_title: 'LSTM',
    category: 'time-series',
    category_label: 'Multi-variate Weather',
    samples_count: '120 observations',
    features_info: 'Date, Temp (°C), Humidity, Wind, Rain in SQLite',
    description: 'Multi-variate continuous meteorological time-series observations in SQLite ideal for multi-step LSTM forecasting.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT date, temperature_c, humidity_pct, wind_speed_kmh, precipitation_mm FROM dataset_weather_timeseries", conn)
print("Weather Observations Shape from SQLite:", df.shape)
print(df.head())`,
    table_name: 'dataset_weather_timeseries'
  },
  {
    id: 'stock_prices',
    name: 'Stock-Price Historical Time Series',
    lab_number: 8,
    experiment_title: 'LSTM',
    category: 'time-series',
    category_label: 'Financial OHLCV',
    samples_count: '100 trading days',
    features_info: 'Date, Ticker, Open, High, Low, Close, Volume in SQLite',
    description: 'Daily OHLCV equity trading time series in SQLite designed for LSTM recurrent price trend modeling and volatility prediction.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT date, ticker, open_price, high_price, low_price, close_price, volume FROM dataset_stock_prices ORDER BY id ASC", conn)
print("Stock Prices Shape from SQLite:", df.shape)
print(df.head())`,
    table_name: 'dataset_stock_prices'
  },
  {
    id: 'imdb_reviews_lstm',
    name: 'IMDB Movie Reviews Sentiment',
    lab_number: 8,
    experiment_title: 'LSTM',
    category: 'nlp',
    category_label: 'NLP / Text Classification',
    samples_count: 'Curated reviews in SQLite',
    features_info: 'Full review text & binary sentiment label',
    description: 'Sentence sequences with positive/negative sentiment labels in SQLite for embedding and bidirectional LSTM network classification.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, review_text, sentiment FROM dataset_imdb_reviews", conn)
print(f"IMDB Reviews Loaded from SQLite: {len(df)}")
df['sentiment_label'] = df['sentiment'].map({1: 'Positive', 0: 'Negative'})
print(df.head())`,
    table_name: 'dataset_imdb_reviews'
  },

  // Lab 9: Recurrent Neural Network
  {
    id: 'shakespeare_corpus',
    name: 'Shakespeare Literary Text Corpus',
    lab_number: 9,
    experiment_title: 'Recurrent Neural Network',
    category: 'nlp',
    category_label: 'Character-Level RNN',
    samples_count: 'Classical Soliloquies in SQLite',
    features_info: 'Play, scene, character, dialogue text',
    description: 'Shakespeare text collection in SQLite ideal for training character-level or word-level Recurrent Neural Networks (RNN).',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT play_name, character_name, dialogue_line FROM dataset_shakespeare_text", conn)
print("Total Dialogue Lines from SQLite:", len(df))

corpus = " ".join(df['dialogue_line'].tolist())
print(f"Total Corpus Length: {len(corpus)} characters")
print(f"Unique Characters: {len(set(corpus))}")
print("\\nFirst 150 characters:\\n", corpus[:150])`,
    table_name: 'dataset_shakespeare_text'
  },
  {
    id: 'reuters_newswire_rnn',
    name: 'Reuters Newswire Topic Classification',
    lab_number: 9,
    experiment_title: 'Recurrent Neural Network',
    category: 'nlp',
    category_label: 'Multi-Class NLP',
    samples_count: 'Curated news stories in SQLite',
    features_info: 'Headline, topic label, summary',
    description: 'Articles across key business categories (earnings, acquisitions, crude oil, forex) in SQLite for sequence RNN categorization.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT headline, topic, summary FROM dataset_reuters_newswire", conn)
print("Reuters Newswire Shape from SQLite:", df.shape)
print("Topics distribution:\\n", df['topic'].value_counts())
print(df.head())`,
    table_name: 'dataset_reuters_newswire'
  },
  {
    id: 'imdb_reviews_rnn',
    name: 'IMDB Reviews (RNN Language Modeling)',
    lab_number: 9,
    experiment_title: 'Recurrent Neural Network',
    category: 'nlp',
    category_label: 'Sequential Text Modeling',
    samples_count: 'Curated reviews in SQLite',
    features_info: 'Sentence sequences for recurrent token prediction',
    description: 'Text reviews in SQLite formatted for word-level and subword RNN sequence language modeling.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, review_text, sentiment FROM dataset_imdb_reviews", conn)
print(f"IMDB Reviews from SQLite: {len(df)}")
tokens = [r.lower().split() for r in df['review_text']]
print(f"Sample token sequence: {tokens[0][:8]}")`,
    table_name: 'dataset_imdb_reviews'
  },
  {
    id: 'sequential_energy_timeseries',
    name: 'Hourly Energy Consumption Time Series',
    lab_number: 9,
    experiment_title: 'Recurrent Neural Network',
    category: 'time-series',
    category_label: 'Sequential Time Series',
    samples_count: '168 hourly records (1 week)',
    features_info: 'Timestamps, Megawatt power demand (MW), Grid Load %',
    description: 'Sequential hourly time-series in SQLite modeling electricity power demand across 168 consecutive hours for RNN sequence architectures.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_energy_timeseries'
  },

  // Lab 10: MNIST image compression using autoencoder
  {
    id: 'mnist_autoencoder',
    name: 'MNIST Compression Benchmark',
    lab_number: 10,
    experiment_title: 'MNIST image compression using autoencoder',
    category: 'vision',
    category_label: 'Autoencoder / Compression',
    samples_count: '1,797 digit vectors in SQLite',
    features_info: '8x8 normalized pixel matrices',
    description: 'Handwritten digit matrices stored directly in SQLite for bottleneck autoencoder encoding, dimensionality reduction, and reconstruction.',
    loader_code: `import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, label, pixel_values FROM dataset_mnist LIMIT 200", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']]) / 16.0 # Normalized [0, 1]
print(f"Input Autoencoder Features: {X.shape[1]} dimensions per image")
print(f"Samples loaded from SQLite: {X.shape[0]}")

plt.figure(figsize=(3, 3))
plt.imshow(X[0].reshape(8, 8), cmap='gray')
plt.title(f"Target Digit: {df['label'].iloc[0]}")
plt.axis('off')
plt.show()`,
    table_name: 'dataset_mnist'
  },
  {
    id: 'fashion_mnist_autoencoder',
    name: 'Fashion-MNIST Autoencoder Compression',
    lab_number: 10,
    experiment_title: 'MNIST image compression using autoencoder',
    category: 'vision',
    category_label: 'Autoencoder / Compression',
    samples_count: '200 clothing vectors in SQLite',
    features_info: '8x8 normalized clothing matrices',
    description: 'Clothing item pixel representations in SQLite for non-linear dimensionality reduction and autoencoder feature extraction.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_fashion_mnist'
  },
  {
    id: 'emnist_letters',
    name: 'EMNIST Extended Letters & Digits',
    lab_number: 10,
    experiment_title: 'MNIST image compression using autoencoder',
    category: 'vision',
    category_label: 'Autoencoder / Vision',
    samples_count: '124 character vectors in SQLite',
    features_info: 'Letters (A-Z, a-z) & Numbers',
    description: 'Extended handwritten character set containing uppercase/lowercase English letters and digits in SQLite for autoencoder latent representation.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_emnist'
  },
  {
    id: 'kmnist_hiragana',
    name: 'KMNIST (Kuzushiji Japanese Characters)',
    lab_number: 10,
    experiment_title: 'MNIST image compression using autoencoder',
    category: 'vision',
    category_label: 'Autoencoder / Vision',
    samples_count: '100 characters in SQLite',
    features_info: '10 Hiragana Classes (8x8 matrices)',
    description: 'Ancient Japanese Kuzushiji Hiragana cursive characters in SQLite for autoencoder reconstruction and manifold learning.',
    loader_code: `import sqlite3
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
plt.show()`,
    table_name: 'dataset_kmnist'
  },

  // Lab 11: Variational Autoencoder (VAE)
  {
    id: 'mnist_vae',
    name: 'MNIST Digits (VAE Latent Space)',
    lab_number: 11,
    experiment_title: 'Variational Autoencoder (VAE)',
    category: 'generative',
    category_label: 'Generative / VAE',
    samples_count: '1,797 samples',
    features_info: '8x8 pixel vectors for latent mean & log-var encoding',
    description: 'Handwritten digit matrices in SQLite for variational autoencoder probabilistic latent space modeling and reconstruction.',
    loader_code: `import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT id, label, pixel_values FROM dataset_mnist LIMIT 200", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']]) / 16.0
print("MNIST for VAE Latent Distribution Learning:", X.shape)
print("Ready for reparameterization trick: z = mu + sigma * epsilon")`,
    table_name: 'dataset_mnist'
  },
  {
    id: 'fashion_mnist_vae',
    name: 'Fashion-MNIST (VAE Clothing Generation)',
    lab_number: 11,
    experiment_title: 'Variational Autoencoder (VAE)',
    category: 'generative',
    category_label: 'Generative / VAE',
    samples_count: '200 samples',
    features_info: '10 clothing categories, continuous latent prior',
    description: 'Fashion articles in SQLite for training continuous latent generative manifolds and sampling unseen garment designs.',
    loader_code: `import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, pixel_values FROM dataset_fashion_mnist", conn)
X = np.array([np.fromstring(p, sep=',') for p in df['pixel_values']])
print("Fashion-MNIST VAE Input Shape:", X.shape)
print("Classes:", df['class_name'].unique().tolist())`,
    table_name: 'dataset_fashion_mnist'
  },
  {
    id: 'cifar10_vae',
    name: 'CIFAR-10 Color Images (VAE)',
    lab_number: 11,
    experiment_title: 'Variational Autoencoder (VAE)',
    category: 'generative',
    category_label: 'Generative / VAE',
    samples_count: '150 samples',
    features_info: 'RGB color signatures (10 categories)',
    description: 'Multi-channel color image samples in SQLite for convolutional variational autoencoders.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 for VAE Multi-Channel Synthesis:", df.shape)
df.head()`,
    table_name: 'dataset_cifar10'
  },
  {
    id: 'celeba_vae',
    name: 'CelebA Facial Attributes (VAE Face Manifold)',
    lab_number: 11,
    experiment_title: 'Variational Autoencoder (VAE)',
    category: 'generative',
    category_label: 'Generative / Faces',
    samples_count: '100 celebrity faces',
    features_info: 'Male, Young, Smiling, Eyeglasses, Blonde, Makeup',
    description: 'Facial attribute vectors in SQLite for learning latent semantic face vectors (e.g. smile vector arithmetic).',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, male, young, smiling, eyeglasses, blonde_hair FROM dataset_celeba", conn)
print("CelebA Face Attributes Loaded from SQLite:", df.shape)
print("Smiling faces:", df['smiling'].sum(), "| Young faces:", df['young'].sum())
df.head()`,
    table_name: 'dataset_celeba'
  },

  // Lab 12: Deep Convolutional GAN for color image generation
  {
    id: 'cifar10_dcgan',
    name: 'CIFAR-10 (DCGAN Color Generation)',
    lab_number: 12,
    experiment_title: 'Deep Convolutional GAN for color image generation',
    category: 'generative',
    category_label: 'DCGAN / Color',
    samples_count: '150 color samples',
    features_info: 'Generator noise vector z -> 32x32 RGB tensor',
    description: 'Color image benchmark in SQLite for adversarial generator-discriminator training and min-max game optimization.',
    loader_code: `import sqlite3
import pandas as pd
import numpy as np

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 Training Set for Discriminator:", df.shape)
z = np.random.normal(0, 1, (16, 100))
print(f"Generator Latent Prior Batch z: {z.shape}")`,
    table_name: 'dataset_cifar10'
  },
  {
    id: 'celeba_dcgan',
    name: 'CelebA (DCGAN Synthetic Face Synthesis)',
    lab_number: 12,
    experiment_title: 'Deep Convolutional GAN for color image generation',
    category: 'generative',
    category_label: 'DCGAN / Faces',
    samples_count: '100 face records',
    features_info: 'Facial features & discriminator adversarial targets',
    description: 'Celebrity face attribute targets in SQLite for DCGAN generator synthesis of realistic human faces from Gaussian noise.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, smiling, young, male, blonde_hair FROM dataset_celeba", conn)
print("CelebA Real Batch for DCGAN Discriminator:", df.shape)
df.head()`,
    table_name: 'dataset_celeba'
  },
  {
    id: 'oxford_pet_dcgan',
    name: 'Oxford-IIIT Pet (DCGAN Animal Synthesis)',
    lab_number: 12,
    experiment_title: 'Deep Convolutional GAN for color image generation',
    category: 'generative',
    category_label: 'DCGAN / Animals',
    samples_count: '17 pet breeds',
    features_info: 'Canine and feline fine-grained textures',
    description: 'Fine-grained cat and dog breed representations in SQLite for multi-class conditional DCGAN animal generation.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, fur_type FROM dataset_pet_breeds", conn)
print("Pet Breeds DCGAN Training Targets:", len(df))
df.head()`,
    table_name: 'dataset_pet_breeds'
  },
  {
    id: 'stl10_dcgan',
    name: 'STL-10 Higher-Resolution Color Images',
    lab_number: 12,
    experiment_title: 'Deep Convolutional GAN for color image generation',
    category: 'generative',
    category_label: 'DCGAN / 96x96 Color',
    samples_count: '100 samples (10 classes)',
    features_info: 'Airplane, bird, car, cat, deer, dog, horse, monkey, ship, truck',
    description: 'Higher-resolution color image samples in SQLite designed for DCGAN transposed convolution upsampling layers.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_stl10", conn)
print("STL-10 Color Images Loaded from SQLite:", df.shape)
print("Classes:", df['class_name'].unique().tolist())
df.head()`,
    table_name: 'dataset_stl10'
  },

  // Lab 13: Understand pre-trained model architecture
  {
    id: 'architecture_inspection',
    name: 'Pre-Trained Architectures & Benchmarks',
    lab_number: 13,
    experiment_title: 'Understand pre-trained model architecture',
    category: 'transfer-learning',
    category_label: 'Architecture Analysis',
    samples_count: 'Modern SOTA Architectures',
    features_info: 'Layer depths, FLOPs, Parameter counts, Top-1/Top-5 Acc',
    description: 'Standard benchmark architectures (ResNet-50, VGG-16, MobileNet-V2, EfficientNet-B0) with parameter profiles and feature dimensions in SQLite.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT model_name, top_1_accuracy, top_5_accuracy, params_millions, feature_dimensions FROM dataset_imagenet_samples", conn)
print("Pre-Trained Deep Architecture Comparisons:")
print(df.to_string(index=False))`,
    table_name: 'dataset_imagenet_samples'
  },
  {
    id: 'imagenet_samples',
    name: 'ImageNet-1K Reference Classes & Synsets',
    lab_number: 13,
    experiment_title: 'Understand pre-trained model architecture',
    category: 'transfer-learning',
    category_label: 'ImageNet Classes',
    samples_count: '1,000 class taxonomy',
    features_info: 'WordNet Synsets, classification categories',
    description: 'Reference ImageNet categories and synset IDs in SQLite for inspecting output layer logit mappings.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT synset_id, class_name, model_name FROM dataset_imagenet_samples", conn)
print("ImageNet Synsets Loaded from SQLite:", len(df))
df.head()`,
    table_name: 'dataset_imagenet_samples'
  },

  // Lab 14: Pre-trained CNN as a feature extractor
  {
    id: 'cats_dogs_transfer',
    name: 'Cats vs Dogs (CNN Feature Extraction)',
    lab_number: 14,
    experiment_title: 'Pre-trained CNN as a feature extractor',
    category: 'transfer-learning',
    category_label: 'Feature Extraction',
    samples_count: '100 samples',
    features_info: 'Penultimate bottleneck embeddings, binary targets',
    description: 'Cat vs Dog samples in SQLite ready for extracting convolutional embeddings without retraining the backbone.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label, target, color_r, color_g, color_b, ear_pointiness, whisker_score FROM dataset_cats_vs_dogs", conn)
print("Cats vs Dogs Ready for CNN Embedding Extraction:", df.shape)
df.head()`,
    table_name: 'dataset_cats_vs_dogs'
  },
  {
    id: 'oxford_pet_transfer',
    name: 'Oxford-IIIT Pet (Fine-Grained Transfer)',
    lab_number: 14,
    experiment_title: 'Pre-trained CNN as a feature extractor',
    category: 'transfer-learning',
    category_label: 'Fine-Grained Transfer',
    samples_count: '17 breeds',
    features_info: 'Transfer features for fine-grained pet categories',
    description: 'Pet breed representations in SQLite for linear probing and logistic classification on top of frozen CNN features.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT breed_name, species, origin, fur_type, avg_weight_kg FROM dataset_pet_breeds", conn)
print("Pet Breeds Loaded for Feature Transfer:", df.shape)
df.head()`,
    table_name: 'dataset_pet_breeds'
  },
  {
    id: 'cifar10_transfer',
    name: 'CIFAR-10 (Pre-trained Feature Extraction)',
    lab_number: 14,
    experiment_title: 'Pre-trained CNN as a feature extractor',
    category: 'transfer-learning',
    category_label: 'Feature Extraction',
    samples_count: '150 samples',
    features_info: 'ResNet/MobileNet feature vectors across 10 classes',
    description: '10-class image samples in SQLite for training a simple linear classifier on frozen pre-trained feature vectors.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, color_r, color_g, color_b FROM dataset_cifar10", conn)
print("CIFAR-10 Feature Extractor Targets:", df.shape)
df.head()`,
    table_name: 'dataset_cifar10'
  },
  {
    id: 'cifar100_transfer',
    name: 'CIFAR-100 (Deep Multi-Class Transfer)',
    lab_number: 14,
    experiment_title: 'Pre-trained CNN as a feature extractor',
    category: 'transfer-learning',
    category_label: '100-Class Transfer',
    samples_count: '100 classes across 20 superclasses',
    features_info: 'Hierarchical category embeddings',
    description: 'Fine-grained 100-class dataset in SQLite evaluating pre-trained CNN generalization across diverse visual domains.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT class_id, class_name, superclass FROM dataset_cifar100", conn)
print("CIFAR-100 Loaded for Transfer Benchmark:", len(df))
df.head()`,
    table_name: 'dataset_cifar100'
  },
  {
    id: 'caltech101_transfer',
    name: 'Caltech-101 Object Categories',
    lab_number: 14,
    experiment_title: 'Pre-trained CNN as a feature extractor',
    category: 'transfer-learning',
    category_label: 'Object Categorization',
    samples_count: '35 object classes',
    features_info: 'Accordion, airplanes, camera, elephant, etc.',
    description: 'Classic Caltech-101 object categories in SQLite for evaluating transfer learning accuracy with small sample sizes.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT category_name, samples_count, avg_aspect_ratio, feature_descriptor FROM dataset_caltech101", conn)
print("Caltech-101 Categories Loaded from SQLite:", len(df))
df.head(10)`,
    table_name: 'dataset_caltech101'
  },

  // Lab 15: YOLO object detection
  {
    id: 'coco_detection',
    name: 'MS COCO Object Detection Annotations',
    lab_number: 15,
    experiment_title: 'YOLO object detection',
    category: 'object-detection',
    category_label: 'YOLO / COCO',
    samples_count: '40 bounding boxes',
    features_info: 'Bbox coordinates (x, y, w, h), category labels, area',
    description: 'Standard MS COCO detection bounding boxes in SQLite for training YOLO anchor priors and multi-scale detection loss.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, category_name, bbox_x, bbox_y, bbox_width, bbox_height FROM dataset_coco_detection", conn)
print("COCO Bounding Box Annotations Loaded from SQLite:", len(df))
print(df['category_name'].value_counts())
df.head()`,
    table_name: 'dataset_coco_detection'
  },
  {
    id: 'pascal_voc_detection',
    name: 'Pascal VOC Bounding Boxes & Ground Truth',
    lab_number: 15,
    experiment_title: 'YOLO object detection',
    category: 'object-detection',
    category_label: 'YOLO / VOC',
    samples_count: '35 annotations (20 classes)',
    features_info: 'xmin, ymin, xmax, ymax pixel coordinates',
    description: 'Pascal VOC ground truth bounding boxes in SQLite for evaluating mean Average Precision (mAP@0.5) and Intersection-over-Union (IoU).',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_name, class_name, xmin, ymin, xmax, ymax FROM dataset_pascal_voc", conn)
print("Pascal VOC Ground Truth Boxes Loaded from SQLite:", len(df))
df.head()`,
    table_name: 'dataset_pascal_voc'
  },
  {
    id: 'open_images_detection',
    name: 'Google Open Images Object Detection',
    lab_number: 15,
    experiment_title: 'YOLO object detection',
    category: 'object-detection',
    category_label: 'YOLO / Open Images',
    samples_count: '30 detection boxes',
    features_info: 'Normalized [x_min, y_min, x_max, y_max], confidence',
    description: 'Large-scale Open Images bounding boxes in SQLite for testing multi-label object detectors and non-maximum suppression (NMS).',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_id, label_name, confidence, x_min, y_min, x_max, y_max FROM dataset_open_images", conn)
print("Open Images Detection Boxes Loaded from SQLite:", len(df))
df.head()`,
    table_name: 'dataset_open_images'
  },
  {
    id: 'kitti_detection',
    name: 'KITTI Autonomous Driving Vision Detection',
    lab_number: 15,
    experiment_title: 'YOLO object detection',
    category: 'object-detection',
    category_label: 'YOLO / KITTI',
    samples_count: '30 vehicle/pedestrian detections',
    features_info: 'Car, Van, Pedestrian, Cyclist, distance, occlusion',
    description: 'Autonomous driving camera detections in SQLite for training YOLO models on road scenes, occlusion levels, and distance estimation.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT frame_id, object_type, bbox_left, bbox_top, bbox_right, bbox_bottom, distance_meters FROM dataset_kitti_detection", conn)
print("KITTI Vision Ground Truth Detections Loaded:", len(df))
df.head()`,
    table_name: 'dataset_kitti_detection'
  },
  {
    id: 'custom_labeled_yolo',
    name: 'Custom Labeled YOLO Format Bounding Boxes',
    lab_number: 15,
    experiment_title: 'YOLO object detection',
    category: 'object-detection',
    category_label: 'YOLO / Custom txt',
    samples_count: '25 normalized targets',
    features_info: '<class_id> <x_center> <y_center> <width> <height>',
    description: 'Exact normalized bounding box format used by YOLO .txt annotations [0-1] for direct training with Darknet and PyTorch YOLO pipelines.',
    loader_code: `import sqlite3
import pandas as pd

conn = sqlite3.connect('database/pyshield.db')
df = pd.read_sql("SELECT image_filename, class_id, class_label, x_center, y_center, width, height FROM dataset_custom_detection", conn)
print("Custom YOLO Annotations (<class> <x_c> <y_c> <w> <h>):", len(df))
df.head()`,
    table_name: 'dataset_custom_detection'
  }
];


export interface DatasetProps {
  onInsertCode: (code: string, datasetName: string) => void;
  showToast?: (message: string) => void;
}

export const Dataset: React.FC<DatasetProps> = ({ onInsertCode, showToast }) => {
  const [datasetsList, setDatasetsList] = useState<LabDataset[]>(LAB_DATASETS);
  const [datasetSearch, setDatasetSearch] = useState<string>('');
  const [copiedDatasetId, setCopiedDatasetId] = useState<string | null>(null);

  // Fetch live datasets from local SQLite DB on mount
  useEffect(() => {
    const host = window.location.hostname || '127.0.0.1';
    fetch(`http://${host}:5001/api/datasets`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && Array.isArray(data.datasets) && data.datasets.length > 0) {
          setDatasetsList(data.datasets);
        }
      })
      .catch(() => {
        // Fallback to static preloaded list
      });
  }, []);

  const handleCopyDatasetCode = (datasetId: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedDatasetId(datasetId);
      if (showToast) showToast('Copied dataset loader to clipboard.');
      setTimeout(() => setCopiedDatasetId(null), 2000);
    }).catch(() => {
      setCopiedDatasetId(datasetId);
      setTimeout(() => setCopiedDatasetId(null), 2000);
    });
  };

  const filteredDatasets = datasetsList.filter(ds => {
    const query = datasetSearch.trim().toLowerCase();
    return query === '' ||
      ds.name.toLowerCase().includes(query) ||
      ds.description.toLowerCase().includes(query) ||
      (ds.experiment_title && ds.experiment_title.toLowerCase().includes(query)) ||
      (ds.category_label && ds.category_label.toLowerCase().includes(query)) ||
      (ds.categoryLabel && ds.categoryLabel.toLowerCase().includes(query));
  });

  return (
    <div className="sidebar-tab-content">
      <div className="sidebar-pane-header">
        <span>LAB DATASETS</span>
        <span className="datasets-header-badge">{filteredDatasets.length} ready</span>
      </div>

      <div className="datasets-search-box">
        <div className="datasets-search-input-wrapper">
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            className="datasets-search-input"
            placeholder="Search datasets..."
            value={datasetSearch}
            onChange={(e) => setDatasetSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="datasets-list">
        {filteredDatasets.length === 0 ? (
          <div className="datasets-empty">
            No datasets found matching your filters.
          </div>
        ) : (
          filteredDatasets.map(ds => (
            <div key={ds.id} className="dataset-card">
              <div className="dataset-card-top">
                <div className="dataset-title-row">
                  <span className="dataset-card-title">{ds.name}</span>
                  {ds.lab_number && (
                    <span className="dataset-lab-pill">Lab {ds.lab_number}</span>
                  )}
                </div>
                <div className="dataset-badge-row">
                  <span className={`dataset-tag ${ds.category}`}>
                    {ds.category_label || ds.categoryLabel || ds.category}
                  </span>
                  {ds.table_name && (
                    <span className="dataset-sql-table" title={`SQLite table: ${ds.table_name}`}>
                      <Database size={10} />
                      <span className="dataset-sql-name">{ds.table_name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="dataset-card-specs">
                <span className="dataset-spec-pill">{ds.samples_count || ds.rows}</span>
                {ds.features_info && (
                  <span className="dataset-spec-info">{ds.features_info}</span>
                )}
              </div>

              <p className="dataset-card-desc">{ds.description}</p>
              <div className="dataset-card-actions">
                <button
                  type="button"
                  className="dataset-action-btn primary"
                  onClick={() => onInsertCode(ds.loader_code || ds.codeSnippet || '', ds.name)}
                  title="Insert loader code into notebook"
                >
                  <Plus size={12} />
                  <span>Insert Code</span>
                </button>
                <button
                  type="button"
                  className="dataset-action-btn"
                  onClick={() => handleCopyDatasetCode(ds.id, ds.loader_code || ds.codeSnippet || '')}
                  title="Copy loader code"
                >
                  {copiedDatasetId === ds.id ? (
                    <>
                      <Check size={12} color="var(--success)" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="datasets-footer-note">
        Offline SQLite Database: All datasets are pre-loaded in database/pyshield.db for offline experimentation.
      </div>
    </div>
  );
};

export { Dataset as LabDatasets, Dataset as LabDatasetsTab };
export default Dataset;
