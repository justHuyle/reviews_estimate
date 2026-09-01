from flask import Flask, request, jsonify, render_template, send_from_directory
import joblib
import os
import re

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static'),
            template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates'))

# Load Pipeline đã lưu (TF-IDF + Logistic Regression)
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ecommerce_preference_model.pkl")
model = joblib.load(MODEL_PATH)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        review = data.get("review", "").strip()

        if not review:
            return jsonify({"success": False, "error": "Please enter a customer review to analyze."}), 400

        if len(review) < 10:
            return jsonify({"success": False, "error": "Review is too short. Please enter at least 10 characters."}), 400

        if len(review) > 5000:
            return jsonify({"success": False, "error": "Review is too long. Please limit to 5000 characters."}), 400

        words = re.findall(r'[a-zA-Z]+', review)
        if len(words) < 3:
            return jsonify({"success": False, "error": "Please enter a valid review with at least 3 words."}), 400

        prediction = model.predict([review])[0]
        probabilities = model.predict_proba([review])[0]

        positive_prob = float(probabilities[1])
        negative_prob = float(probabilities[0])
        label = "Positive" if prediction == 1 else "Negative"
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
                interpretation = "The review strongly expresses negative customer sentiment. The customer appears very dissatisfied."
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


@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)


# Vercel entry point
app = app
