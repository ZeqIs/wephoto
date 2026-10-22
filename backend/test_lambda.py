import unittest
import json
import re
from unittest.mock import MagicMock
import lambda_function

class TestLambdaFunction(unittest.TestCase):
    def setUp(self):
        # Mock boto3 S3 client
        self.mock_s3 = MagicMock()
        self.mock_s3.generate_presigned_url.side_effect = (
            lambda ClientMethod, Params, ExpiresIn: f"https://mock-s3.amazonaws.com/{Params['Bucket']}/{Params['Key']}?sig=123"
        )
        lambda_function.s3_client = self.mock_s3

    def test_sanitize_username(self):
        self.assertEqual(lambda_function.sanitize_username("John Doe"), "JohnDoe")
        self.assertEqual(lambda_function.sanitize_username("Jane @#$! Smith"), "JaneSmith")
        self.assertEqual(lambda_function.sanitize_username("   "), "Guest")
        self.assertEqual(lambda_function.sanitize_username(None), "Guest")

    def test_generate_session_code(self):
        code = lambda_function.generate_session_code(8)
        self.assertEqual(len(code), 8)
        self.assertTrue(re.match(r"^[A-Z0-9]{8}$", code))

    def test_successful_payload(self):
        event = {
            "body": json.dumps({
                "name": "Sarah Connor",
                "files": [
                    {"type": "image/jpeg", "extension": "jpg"},
                    {"type": "video/mp4", "extension": "mp4"},
                    {"type": "image/png", "extension": ".png"},
                    {"type": "image/jpeg"},
                    {"type": "video/quicktime"}
                ]
            })
        }
        response = lambda_function.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")
        
        body = json.loads(response["body"])
        self.assertEqual(body["sanitizedName"], "SarahConnor")
        self.assertEqual(len(body["sessionCode"]), 8)
        self.assertEqual(body["count"], 5)
        self.assertEqual(len(body["items"]), 5)

        # Validate naming convention: [SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]
        pattern = re.compile(r"^uploads/SarahConnor_[A-Z0-9]{8}_([1-5])\.(jpg|mp4|png|mov)$")
        for idx, item in enumerate(body["items"], start=1):
            key = item["key"]
            self.assertTrue(pattern.match(key), f"Key {key} does not match expected format.")
            self.assertEqual(item["itemNumber"], idx)
            self.assertTrue("https://mock-s3.amazonaws.com" in item["uploadUrl"])

    def test_more_than_five_files_rejected(self):
        event = {
            "body": json.dumps({
                "name": "Alice",
                "files": [{"type": "image/jpeg"}] * 6
            })
        }
        response = lambda_function.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 400)
        body = json.loads(response["body"])
        self.assertIn("maximum of 5 files", body["error"])

    def test_cors_options(self):
        event = {
            "requestContext": {"http": {"method": "OPTIONS"}}
        }
        response = lambda_function.lambda_handler(event, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")

if __name__ == "__main__":
    unittest.main()
