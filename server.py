from flask import Flask, request, jsonify, render_template, send_from_directory
import joblib
import pandas as pd
import os
import re

app = Flask(__name__, static_folder='static', template_folder='templates')

# Load Pipeline đã lưu (ColumnTransformer + Logistic Regression)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts_ecommerce_review_model.joblib")
model = joblib.load(MODEL_PATH)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        # --- Input Validation ---
        review = data.get("review", "").strip()

        if not review:
            return jsonify({
                "success": False,
                "error": "Please enter a customer review to analyze."
            }), 400

        if len(review) < 10:
            return jsonify({
                "success": False,
                "error": "Review is too short. Please enter at least 10 characters for meaningful analysis."
            }), 400

        if len(review) > 5000:
            return jsonify({
                "success": False,
                "error": "Review is too long. Please limit to 5000 characters."
            }), 400

        # Kiểm tra review có chứa ít nhất một từ có ý nghĩa
        words = re.findall(r'[a-zA-Z]+', review)
        if len(words) < 3:
            return jsonify({
                "success": False,
                "error": "Please enter a valid review with at least 3 words."
            }), 400

        # --- Preprocessing + Prediction ---
        # Model pipeline cần DataFrame với các cột:
        # Age, Positive Feedback Count, Review_Length, Department Name, Review Text
        input_df = pd.DataFrame([{
            "Age": data.get("age", 30),
            "Positive Feedback Count": data.get("positive_feedback_count", 0),
            "Review_Length": len(review),
            "Department Name": data.get("department_name", "General"),
            "Review Text": review
        }])

        prediction = model.predict(input_df)[0]
        probabilities = model.predict_proba(input_df)[0]

        # Classes: [0, 1] → [Negative, Positive]
        positive_prob = float(probabilities[1])
        negative_prob = float(probabilities[0])

        label = "Positive" if prediction == 1 else "Negative"

        # Tạo interpretation dựa trên kết quả
        confidence = max(positive_prob, negative_prob)
        if label == "Positive":
            if confidence > 0.9:
                interpretation = "The review strongly expresses positive customer preference. The customer appears very satisfied with the product."
            elif confidence > 0.7:
                interpretation = "The review expresses positive customer preference. The customer appears generally satisfied."
            else:
                interpretation = "The review leans toward positive sentiment, but the opinion is mixed or moderate."
        else:
            if confidence > 0.9:
                interpretation = "The review strongly expresses negative customer sentiment. The customer appears very dissatisfied with the product."
            elif confidence > 0.7:
                interpretation = "The review expresses negative customer sentiment. The customer appears generally dissatisfied."
            else:
                interpretation = "The review leans toward negative sentiment, but the opinion is mixed or moderate."

        return jsonify({
            "success": True,
            "prediction": int(prediction),
            "label": label,
            "probability": round(positive_prob, 4),
            "negative_probability": round(negative_prob, 4),
            "confidence": round(confidence, 4),
            "interpretation": interpretation
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Serve static files
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)


if __name__ == "__main__":
    # Host 0.0.0.0 để điện thoại cùng mạng Wi-Fi truy cập được
    print("[*] E-Commerce Review Analyzer running at http://localhost:5000")
    print("[*] Mobile access: http://<your-ip>:5000")
    app.run(host="0.0.0.0", port=5001, debug=True)
