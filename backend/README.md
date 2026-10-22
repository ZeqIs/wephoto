# Backend Deployment Guide: AWS Lambda & S3 Direct Upload

This backend provides presigned S3 URLs allowing static web clients (such as your GitHub Pages site) to securely upload wedding photos and videos directly into your private S3 bucket without exposing AWS credentials.

---

## 1. Amazon S3 Bucket Setup

1. In the AWS S3 Console, create a new bucket (e.g. `is-and-mimi-wedding-photos`).
2. Keep **Block all public access** enabled.
3. Under the **Permissions** tab, scroll to **Cross-origin resource sharing (CORS)** and configure:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "PUT"
    ],
    "AllowedOrigins": [
      "https://<your-username>.github.io",
      "http://localhost:8080",
      "http://127.0.0.1:8080"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 2. IAM Role for AWS Lambda

Create an IAM execution role for Lambda with the following inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::is-and-mimi-wedding-photos/uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

---

## 3. Deploy the AWS Lambda Function

1. Create a Lambda function with runtime **Python 3.10** (or 3.11 / 3.12).
2. Copy the contents of `lambda_function.py` into `lambda_function.py` in the Lambda code editor.
3. In **Configuration -> Environment variables**, add:
   - `S3_BUCKET_NAME`: `is-and-mimi-wedding-photos` (your bucket name)
   - `URL_EXPIRATION_SECONDS`: `300` (5 minutes)
   - `AWS_REGION`: `ap-southeast-1` (or your chosen region)
4. Deploy the Lambda function.

---

## 4. API Gateway Setup

1. Create an **HTTP API** in Amazon API Gateway.
2. Add a route: `POST /upload-urls` and attach the Lambda integration.
3. Under **CORS** in API Gateway settings, set:
   - **Access-Control-Allow-Origin**: `*` (or your GitHub Pages domain)
   - **Access-Control-Allow-Methods**: `POST, OPTIONS`
   - **Access-Control-Allow-Headers**: `Content-Type, Authorization, X-Requested-With`
4. Copy your API's invoke URL (e.g. `https://xyz123.execute-api.ap-southeast-1.amazonaws.com/upload-urls`).
5. Paste this URL into `CONFIG.API_ENDPOINT` in `js/app.js` (or `app.js`).
