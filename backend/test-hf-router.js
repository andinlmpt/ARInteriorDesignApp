import dotenv from 'dotenv';
dotenv.config();

async function testRoute() {
  try {
    const response = await fetch(
      "https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: "a cozy reading nook" }),
      }
    );
    
    console.log("Status:", response.status);
    if (response.ok) {
      console.log("Success! router.huggingface.co/hf-inference works.");
    } else {
      console.log("Error body:", await response.text());
    }
  } catch (error) {
    console.error("Fetch failed:", error.message);
  }
}
testRoute();
