
import requests

def upload_pdf(pdf_path, url="http://localhost:8001/extract_table"):
    files = {'file': open(pdf_path, 'rb')}
    response = requests.post(url, files=files)
    
    if response.status_code == 200:
        print("Success! Extracted CSV saved to output.csv")
        with open("output.csv", "wb") as f:
            f.write(response.content)
    else:
        print(f"Error: {response.status_code} - {response.text}")

if __name__ == "__main__":
    # Change this to your test PDF path
    pdf_path = "test.pdf" 
    upload_pdf(pdf_path)
