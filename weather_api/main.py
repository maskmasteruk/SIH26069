import json
import os
import sqlite3
import requests
from datetime import datetime, timezone

from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer
from kafka.serializer import DefaultSerializer, JsonSerializer


# ============================================================
# LOAD CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

load_dotenv(
    os.path.join(
        BASE_DIR,
        ".env"
    )
)


def env_list(name: str, default: str):

    return [
        item.strip()
        for item in os.getenv(name, default).split(",")
        if item.strip()
    ]


def output_file_path(filename: str):

    if (
            os.path.isabs(filename)
            or os.path.dirname(filename)
    ):

        return filename

    return os.path.join(
        BASE_DIR,
        "output",
        filename
    )


def ensure_output_directory(path: str):

    directory = os.path.dirname(path)

    if directory:
        os.makedirs(
            directory,
            exist_ok=True
        )


def now_iso():

    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================================
# CONFIGURATION
# ============================================================

KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092"
)

INPUT_TOPIC = os.getenv(
    "KAFKA_INPUT_TOPIC",
    "location_data"
)

OUTPUT_TOPIC = os.getenv(
    "KAFKA_OUTPUT_TOPIC",
    "weather_data"
)

KAFKA_GROUP_ID = os.getenv(
    "KAFKA_GROUP_ID",
    "weather_service"
)

WEATHER_API_URL = os.getenv(
    "WEATHER_API_URL",
    "https://api.open-meteo.com/v1/forecast"
)

WEATHER_API_TIMEOUT_SECONDS = int(
    os.getenv("WEATHER_API_TIMEOUT_SECONDS", "15")
)

WEATHER_TIMEZONE = os.getenv(
    "WEATHER_TIMEZONE",
    "auto"
)

WEATHER_CURRENT_FIELDS = env_list(
    "WEATHER_CURRENT_FIELDS",
    (
        "temperature_2m,"
        "relative_humidity_2m,"
        "apparent_temperature,"
        "precipitation,"
        "rain,"
        "weather_code,"
        "cloud_cover,"
        "wind_speed_10m,"
        "wind_direction_10m,"
        "wind_gusts_10m,"
        "pressure_msl"
    )
)

DATABASE_FILE = output_file_path(
    os.getenv(
        "DATABASE_FILE",
        "weather_api.db"
    )
)

JSON_SERIALIZER = JsonSerializer()
STRING_SERIALIZER = DefaultSerializer()


# ============================================================
# DATABASE
# ============================================================

def connect_database():

    ensure_output_directory(
        DATABASE_FILE
    )

    connection = sqlite3.connect(
        DATABASE_FILE
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():

    conn = connect_database()

    cursor = conn.cursor()

    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS weather_events (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,

                       location_key TEXT NOT NULL,
                       latitude REAL NOT NULL,
                       longitude REAL NOT NULL,
                       weather_timestamp TEXT NOT NULL,

                       temperature_celsius REAL,
                       relative_humidity_percent REAL,
                       apparent_temperature_celsius REAL,
                       precipitation_mm REAL,
                       rain_mm REAL,
                       weather_code INTEGER,
                       cloud_cover_percent REAL,
                       pressure_msl_hpa REAL,
                       wind_speed_kmh REAL,
                       wind_direction_degrees REAL,
                       wind_gusts_kmh REAL,

                       first_seen TEXT,
                       last_seen TEXT,

                       raw_json TEXT,

                       UNIQUE(
                           location_key,
                           weather_timestamp
                       )
                   )
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_weather_events_location
                       ON weather_events(location_key)
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_weather_events_timestamp
                       ON weather_events(weather_timestamp)
                   """)

    conn.commit()

    conn.close()


def make_location_key(latitude, longitude):

    return (
        f"{float(latitude):.6f},"
        f"{float(longitude):.6f}"
    )


def save_weather_event(weather_event):

    conn = connect_database()

    cursor = conn.cursor()

    timestamp = now_iso()

    location_key = make_location_key(
        weather_event["latitude"],
        weather_event["longitude"]
    )

    try:

        cursor.execute("""
                       INSERT INTO weather_events (
                           location_key,
                           latitude,
                           longitude,
                           weather_timestamp,

                           temperature_celsius,
                           relative_humidity_percent,
                           apparent_temperature_celsius,
                           precipitation_mm,
                           rain_mm,
                           weather_code,
                           cloud_cover_percent,
                           pressure_msl_hpa,
                           wind_speed_kmh,
                           wind_direction_degrees,
                           wind_gusts_kmh,

                           first_seen,
                           last_seen,

                           raw_json
                       )

                       VALUES (
                           ?, ?, ?, ?,
                           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                           ?, ?,
                           ?
                       )
                       """, (
                           location_key,
                           weather_event.get("latitude"),
                           weather_event.get("longitude"),
                           weather_event.get("weather_timestamp"),

                           weather_event.get("temperature_celsius"),
                           weather_event.get("relative_humidity_percent"),
                           weather_event.get(
                               "apparent_temperature_celsius"
                           ),
                           weather_event.get("precipitation_mm"),
                           weather_event.get("rain_mm"),
                           weather_event.get("weather_code"),
                           weather_event.get("cloud_cover_percent"),
                           weather_event.get("pressure_msl_hpa"),
                           weather_event.get("wind_speed_kmh"),
                           weather_event.get("wind_direction_degrees"),
                           weather_event.get("wind_gusts_kmh"),

                           timestamp,
                           timestamp,

                           json.dumps(
                               weather_event,
                               ensure_ascii=False
                           )
                       ))

        conn.commit()

        is_new = True

    except sqlite3.IntegrityError:

        cursor.execute("""
                       UPDATE weather_events

                       SET
                           temperature_celsius = ?,
                           relative_humidity_percent = ?,
                           apparent_temperature_celsius = ?,
                           precipitation_mm = ?,
                           rain_mm = ?,
                           weather_code = ?,
                           cloud_cover_percent = ?,
                           pressure_msl_hpa = ?,
                           wind_speed_kmh = ?,
                           wind_direction_degrees = ?,
                           wind_gusts_kmh = ?,
                           last_seen = ?,
                           raw_json = ?

                       WHERE
                           location_key = ?
                         AND weather_timestamp = ?
                       """, (
                           weather_event.get("temperature_celsius"),
                           weather_event.get("relative_humidity_percent"),
                           weather_event.get(
                               "apparent_temperature_celsius"
                           ),
                           weather_event.get("precipitation_mm"),
                           weather_event.get("rain_mm"),
                           weather_event.get("weather_code"),
                           weather_event.get("cloud_cover_percent"),
                           weather_event.get("pressure_msl_hpa"),
                           weather_event.get("wind_speed_kmh"),
                           weather_event.get("wind_direction_degrees"),
                           weather_event.get("wind_gusts_kmh"),
                           timestamp,
                           json.dumps(
                               weather_event,
                               ensure_ascii=False
                           ),
                           location_key,
                           weather_event.get("weather_timestamp")
                       ))

        conn.commit()

        is_new = False

    finally:

        conn.close()

    return is_new


# ============================================================
# KAFKA CONSUMER
# ============================================================

consumer = KafkaConsumer(
    INPUT_TOPIC,

    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,

    group_id=KAFKA_GROUP_ID,

    # Convert JSON bytes -> Python dictionary
    value_deserializer=JSON_SERIALIZER,

    auto_offset_reset="earliest",

    enable_auto_commit=True
)


# ============================================================
# KAFKA PRODUCER
# ============================================================

producer = KafkaProducer(

    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,

    # Python dictionary -> JSON bytes
    value_serializer=JSON_SERIALIZER,

    # String key -> bytes
    key_serializer=STRING_SERIALIZER,

    acks="all",

    retries=5
)


# ============================================================
# WEATHER API
# ============================================================

def get_weather(latitude, longitude):

    params = {

        "latitude": latitude,

        "longitude": longitude,

        "current": ",".join(
            WEATHER_CURRENT_FIELDS
        ),

        "timezone": WEATHER_TIMEZONE
    }

    response = requests.get(
        WEATHER_API_URL,
        params=params,
        timeout=WEATHER_API_TIMEOUT_SECONDS
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# PROCESS WEATHER
# ============================================================

def process_location(location):

    # --------------------------------------------------------
    # Read latitude and longitude from Kafka
    # --------------------------------------------------------

    latitude = location["latitude"]
    longitude = location["longitude"]

    print(
        f"\nReceived coordinates:"
        f" lat={latitude}, lon={longitude}"
    )

    # --------------------------------------------------------
    # Call weather API
    # --------------------------------------------------------

    weather = get_weather(
        latitude,
        longitude
    )

    current = weather["current"]

    # --------------------------------------------------------
    # Create output event
    # --------------------------------------------------------

    weather_event = {

        "latitude": latitude,

        "longitude": longitude,

        "weather_timestamp":
            current.get("time") or now_iso(),

        "temperature_celsius":
            current.get("temperature_2m"),

        "relative_humidity_percent":
            current.get("relative_humidity_2m"),

        "apparent_temperature_celsius":
            current.get("apparent_temperature"),

        "precipitation_mm":
            current.get("precipitation"),

        "rain_mm":
            current.get("rain"),

        "weather_code":
            current.get("weather_code"),

        "cloud_cover_percent":
            current.get("cloud_cover"),

        "pressure_msl_hpa":
            current.get("pressure_msl"),

        "wind_speed_kmh":
            current.get("wind_speed_10m"),

        "wind_direction_degrees":
            current.get("wind_direction_10m"),

        "wind_gusts_kmh":
            current.get("wind_gusts_10m")
    }

    return weather_event


# ============================================================
# MAIN CONSUMER LOOP
# ============================================================

print("Weather service started...")
print(f"Reading from : {INPUT_TOPIC}")
print(f"Writing to   : {OUTPUT_TOPIC}")
print(f"Database     : {DATABASE_FILE}")

initialize_database()

total_found = 0
total_new = 0


try:

    for message in consumer:

        try:

            # ------------------------------------------------
            # Kafka message
            # ------------------------------------------------

            location = message.value

            print(
                f"\nKafka message:"
                f" {location}"
            )

            # ------------------------------------------------
            # Validate coordinates
            # ------------------------------------------------

            if "latitude" not in location:
                print("Missing latitude")
                continue

            if "longitude" not in location:
                print("Missing longitude")
                continue

            # ------------------------------------------------
            # Get weather
            # ------------------------------------------------

            weather_event = process_location(
                location
            )

            total_found += 1

            is_new = save_weather_event(
                weather_event
            )

            if not is_new:

                print(
                    "Weather already found; "
                    "database last_seen updated."
                )

                print(
                    f"Totals found={total_found} "
                    f"new={total_new}"
                )

                continue

            total_new += 1

            # ------------------------------------------------
            # Send only new weather records to Kafka
            # ------------------------------------------------

            producer.send(
                OUTPUT_TOPIC,
                key=f"{location['latitude']},{location['longitude']}",
                value=weather_event
            )

            producer.flush()

            print(
                "New weather sent to Kafka:"
            )

            print(
                json.dumps(
                    weather_event,
                    indent=2
                )
            )

            print(
                f"Totals found={total_found} "
                f"new={total_new}"
            )

        except requests.RequestException as e:

            print(
                f"Weather API error: {e}"
            )

        except Exception as e:

            print(
                f"Processing error: {e}"
            )


except KeyboardInterrupt:

    print("\nStopping...")


finally:

    consumer.close()
    producer.close()

    print("Kafka connections closed.")
