from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from collections import OrderedDict
import json, os

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

# Répertoires persistants Render
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

USERS_FILE = os.path.join(DATA_DIR, "users.json")


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username, password = data.get("username"), data.get("password")

    users = []
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)

    if any(u["username"] == username for u in users):
        return jsonify({"error": "user_exists"}), 400

    users.append({"username": username, "password": password})
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=4, ensure_ascii=False)

    return jsonify({"status": "ok"})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username, password = data.get("username"), data.get("password")

    if not os.path.exists(USERS_FILE):
        return jsonify({"error": "no_users"}), 400

    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)

    user = next(
        (u for u in users if u["username"] == username and u["password"] == password),
        None,
    )
    if user:
        return jsonify({"status": "ok"})
    return jsonify({"error": "invalid"}), 401


@app.route("/api/save", methods=["POST"])
def save_data():
    user = request.args.get("user")
    if not user:
        return jsonify({"error": "missing_user"}), 400

    data = request.get_json()
    ordered_data = []
    for room in data:
        ordered_room = OrderedDict(
            [
                ("id", room.get("id")),
                ("user", room.get("user")),
                ("date", room.get("date")),
                ("number", room.get("number")),
                ("price", room.get("price")),
                ("status", room.get("status")),
                ("remark", room.get("remark")),
                ("timestamp", room.get("timestamp")),
            ]
        )
        ordered_data.append(ordered_room)

    user_file = os.path.join(DATA_DIR, f"data_{user}.json")
    with open(user_file, "w", encoding="utf-8") as f:
        json.dump(ordered_data, f, indent=4, ensure_ascii=False)

    return jsonify({"status": "saved"})


@app.route("/api/load", methods=["GET"])
def load_data():
    user = request.args.get("user")
    if not user:
        return jsonify({"error": "missing_user"}), 400

    user_file = os.path.join(DATA_DIR, f"data_{user}.json")
    if not os.path.exists(user_file):
        return jsonify([])

    with open(user_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/change-password", methods=["POST"])
def change_password():
    data = request.get_json()
    username = data.get("username")
    new_password = data.get("newPassword")

    if not username or not new_password:
        return jsonify({"error": "missing_data"}), 400

    if len(new_password.strip()) < 3:
        return jsonify({"error": "invalid_password"}), 400

    if not os.path.exists(USERS_FILE):
        return jsonify({"error": "no_users"}), 400

    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)

    for u in users:
        if u["username"] == username:
            u["password"] = new_password.strip()
            break
    else:
        return jsonify({"error": "user_not_found"}), 404

    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=4, ensure_ascii=False)

    return jsonify({"status": "success"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
