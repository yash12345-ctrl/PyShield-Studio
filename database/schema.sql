-- schema.sql: Offline Proctored Notebook Database Schema (SQLite)

-- 1. Candidates / Students
CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' -- 'active', 'suspended', 'completed'
);

-- 2. Experiments
CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    course_code TEXT NOT NULL,
    created_by TEXT,
    config_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Exam / Lab Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, -- UUID
    registration_number TEXT NOT NULL,
    experiment_id INTEGER,
    workstation_id TEXT DEFAULT 'LAB-03 / SEAT-18',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'terminated'
    violations_count INTEGER DEFAULT 0,
    FOREIGN KEY (registration_number) REFERENCES candidates(registration_number),
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

-- 4. Code Cell Snapshots & Execution Audit Log
CREATE TABLE IF NOT EXISTS cell_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    cell_id TEXT NOT NULL,
    execution_index INTEGER NOT NULL,
    code_content TEXT NOT NULL,
    output_text TEXT,
    has_plot INTEGER DEFAULT 0,
    status TEXT NOT NULL, -- 'success', 'error', 'interrupted'
    execution_time_ms REAL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 5. Security & Proctoring Violations Log
CREATE TABLE IF NOT EXISTS security_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    violation_type TEXT NOT NULL, -- 'internet_detected', 'clipboard_attempt', 'window_blur'
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_reg ON sessions(registration_number);
CREATE INDEX IF NOT EXISTS idx_cell_executions_session ON cell_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_session ON security_violations(session_id);

-- 6. Offline Laboratory Datasets Catalog
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lab_number INTEGER NOT NULL,
    experiment_title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'classification', 'vision', 'time-series', 'nlp'
    category_label TEXT,
    samples_count TEXT,
    features_info TEXT,
    description TEXT,
    loader_code TEXT NOT NULL,
    table_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_datasets_lab ON datasets(lab_number);
CREATE INDEX IF NOT EXISTS idx_datasets_category ON datasets(category);

-- 7. Specific Offline Relational Datasets (Lab 6 - Lab 10)
-- Lab 6: Synthetic classification data
CREATE TABLE IF NOT EXISTS dataset_synthetic_classification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_1 REAL,
    feature_2 REAL,
    feature_3 REAL,
    feature_4 REAL,
    target INTEGER
);

-- Lab 6: Iris Flower dataset
CREATE TABLE IF NOT EXISTS dataset_iris (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sepal_length REAL,
    sepal_width REAL,
    petal_length REAL,
    petal_width REAL,
    species TEXT
);

-- Lab 8: Airline Passenger Time Series (Box-Jenkins)
CREATE TABLE IF NOT EXISTS dataset_airline_passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year_month TEXT NOT NULL,
    passengers INTEGER NOT NULL
);

-- Lab 8: Daily Weather Meteorological Time Series
CREATE TABLE IF NOT EXISTS dataset_weather_timeseries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    temperature_c REAL,
    humidity_pct REAL,
    wind_speed_kmh REAL,
    precipitation_mm REAL
);

-- Lab 8: Stock Price Historical Time Series
CREATE TABLE IF NOT EXISTS dataset_stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    close_price REAL,
    volume INTEGER
);

-- Lab 8 & Lab 9: IMDB Reviews Sentiment
CREATE TABLE IF NOT EXISTS dataset_imdb_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_text TEXT NOT NULL,
    sentiment INTEGER NOT NULL -- 1: Positive, 0: Negative
);

-- Lab 9: Shakespeare Literary Text Corpus
CREATE TABLE IF NOT EXISTS dataset_shakespeare_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    play_name TEXT NOT NULL,
    scene_label TEXT,
    character_name TEXT,
    dialogue_line TEXT NOT NULL
);

-- Lab 9: Reuters Newswire Articles
CREATE TABLE IF NOT EXISTS dataset_reuters_newswire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT
);

-- Lab 7: Oxford-IIIT Pet Breeds
CREATE TABLE IF NOT EXISTS dataset_pet_breeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    breed_name TEXT NOT NULL,
    species TEXT NOT NULL, -- 'Cat' or 'Dog'
    origin TEXT,
    fur_type TEXT,
    avg_weight_kg REAL
);

-- Lab 6 & Lab 10: MNIST Handwritten Digits (0-9)
CREATE TABLE IF NOT EXISTS dataset_mnist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label INTEGER NOT NULL,
    pixel_values TEXT NOT NULL, -- Comma-separated normalized pixel values (8x8 = 64 pixels)
    split TEXT DEFAULT 'train'
);

-- Lab 6 & Lab 10: Fashion-MNIST Clothing Benchmark (10 classes)
CREATE TABLE IF NOT EXISTS dataset_fashion_mnist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    pixel_values TEXT NOT NULL, -- Comma-separated pixel values (8x8) representing clothing item
    split TEXT DEFAULT 'train'
);

-- Lab 7: Cats vs Dogs Binary Classification
CREATE TABLE IF NOT EXISTS dataset_cats_vs_dogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    label TEXT NOT NULL, -- 'cat' or 'dog'
    target INTEGER NOT NULL, -- 0 for cat, 1 for dog
    color_r REAL,
    color_g REAL,
    color_b REAL,
    aspect_ratio REAL,
    whisker_score REAL,
    ear_pointiness REAL,
    pixel_values TEXT -- Flattened 64-pixel feature representation
);

-- Lab 7: CIFAR-10 Object Classification (10 classes)
CREATE TABLE IF NOT EXISTS dataset_cifar10 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    color_r REAL,
    color_g REAL,
    color_b REAL,
    pixel_values TEXT, -- Flattened 64-pixel color image representation
    split TEXT DEFAULT 'train'
);

-- Lab 7: CIFAR-100 Fine-Grained Objects (100 classes, 20 superclasses)
CREATE TABLE IF NOT EXISTS dataset_cifar100 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    superclass TEXT NOT NULL,
    pixel_values TEXT
);

-- Lab 9: Sequential Energy Demand Time Series
CREATE TABLE IF NOT EXISTS dataset_energy_timeseries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    megawatts_demand REAL NOT NULL,
    grid_load_pct REAL NOT NULL,
    status TEXT DEFAULT 'normal'
);

-- Lab 10: EMNIST Extended Letters & Digits
CREATE TABLE IF NOT EXISTS dataset_emnist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character TEXT NOT NULL,
    category TEXT NOT NULL, -- 'uppercase', 'lowercase', 'digit'
    label_id INTEGER NOT NULL,
    pixel_values TEXT NOT NULL
);

-- Lab 10: KMNIST (Kuzushiji Japanese Hiragana Characters)
CREATE TABLE IF NOT EXISTS dataset_kmnist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name TEXT NOT NULL, -- 'o', 'ki', 'su', 'tsu', 'na', 'ha', 'ma', 'ya', 're', 'wo'
    hiragana_char TEXT NOT NULL, -- 'お', 'き', 'す', 'つ', 'な', 'は', 'ま', 'や', 'れ', 'を'
    label_id INTEGER NOT NULL,
    pixel_values TEXT NOT NULL
);

-- Lab 11 & Lab 12: CelebA Face Attributes & Landmarks
CREATE TABLE IF NOT EXISTS dataset_celeba (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    male INTEGER NOT NULL, -- 1: male, 0: female
    young INTEGER NOT NULL, -- 1: yes, 0: no
    smiling INTEGER NOT NULL,
    eyeglasses INTEGER NOT NULL,
    blonde_hair INTEGER NOT NULL,
    heavy_makeup INTEGER NOT NULL,
    feature_vector TEXT NOT NULL
);

-- Lab 12: STL-10 10-Class Color Images
CREATE TABLE IF NOT EXISTS dataset_stl10 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    class_name TEXT NOT NULL, -- airplane, bird, car, cat, deer, dog, horse, monkey, ship, truck
    color_r REAL,
    color_g REAL,
    color_b REAL,
    pixel_values TEXT,
    split TEXT DEFAULT 'train'
);

-- Lab 13: ImageNet Reference Classes & Pretrained Architectures
CREATE TABLE IF NOT EXISTS dataset_imagenet_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    synset_id TEXT NOT NULL,
    class_name TEXT NOT NULL,
    model_name TEXT NOT NULL, -- ResNet-50, VGG-16, MobileNet-V2, EfficientNet-B0
    top_1_accuracy REAL,
    top_5_accuracy REAL,
    params_millions REAL,
    feature_dimensions INTEGER,
    sample_feature_vector TEXT
);

-- Lab 14: Caltech-101 Fine-Grained Object Categories
CREATE TABLE IF NOT EXISTS dataset_caltech101 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL,
    samples_count INTEGER,
    avg_aspect_ratio REAL,
    feature_descriptor TEXT NOT NULL
);

-- Lab 15: MS COCO Object Detection Annotations
CREATE TABLE IF NOT EXISTS dataset_coco_detection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    bbox_x REAL NOT NULL,
    bbox_y REAL NOT NULL,
    bbox_width REAL NOT NULL,
    bbox_height REAL NOT NULL,
    area REAL
);

-- Lab 15: Pascal VOC Object Detection (20 classes)
CREATE TABLE IF NOT EXISTS dataset_pascal_voc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    xmin INTEGER NOT NULL,
    ymin INTEGER NOT NULL,
    xmax INTEGER NOT NULL,
    ymax INTEGER NOT NULL,
    difficult INTEGER DEFAULT 0
);

-- Lab 15: Open Images Detection Subset
CREATE TABLE IF NOT EXISTS dataset_open_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    label_name TEXT NOT NULL,
    confidence REAL NOT NULL,
    x_min REAL NOT NULL,
    x_max REAL NOT NULL,
    y_min REAL NOT NULL,
    y_max REAL NOT NULL
);

-- Lab 15: KITTI Autonomous Driving Vision Detection
CREATE TABLE IF NOT EXISTS dataset_kitti_detection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_id TEXT NOT NULL,
    object_type TEXT NOT NULL, -- Car, Van, Truck, Pedestrian, Cyclist
    truncated REAL,
    occluded INTEGER,
    bbox_left REAL NOT NULL,
    bbox_top REAL NOT NULL,
    bbox_right REAL NOT NULL,
    bbox_bottom REAL NOT NULL,
    distance_meters REAL
);

-- Lab 15: Custom Labeled Detection (Normalized YOLO Format)
CREATE TABLE IF NOT EXISTS dataset_custom_detection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_filename TEXT NOT NULL,
    class_id INTEGER NOT NULL,
    class_label TEXT NOT NULL,
    x_center REAL NOT NULL, -- Normalized [0, 1]
    y_center REAL NOT NULL, -- Normalized [0, 1]
    width REAL NOT NULL,    -- Normalized [0, 1]
    height REAL NOT NULL,   -- Normalized [0, 1]
    confidence REAL DEFAULT 1.0
);

-- 8. Candidate Project / Lab Folders
CREATE TABLE IF NOT EXISTS user_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_number TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(registration_number, folder_name)
);
CREATE INDEX IF NOT EXISTS idx_user_folders_reg ON user_folders(registration_number);
