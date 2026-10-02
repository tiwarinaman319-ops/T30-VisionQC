const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

async function getJSON(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || `Backend error: ${response.status}`
    );
  }

  return data;
}

export async function trainBaseline(frames) {
  const formData = new FormData();

  frames.forEach((frame, index) => {
    formData.append(
      "files",
      dataURLToBlob(frame),
      `baseline_${index + 1}.jpg`
    );
  });

  const response = await fetch(`${API_BASE}/train`, {
    method: "POST",
    body: formData,
  });

  return getJSON(response);
}

export async function inspectFrame(base64Image) {
  const blob = dataURLToBlob(base64Image);

  const formData = new FormData();
  formData.append("file", blob, "inspection.jpg");

  const response = await fetch(`${API_BASE}/inspect`, {
    method: "POST",
    body: formData,
  });

  return getJSON(response);
}

export async function getThreshold() {
  const response = await fetch(`${API_BASE}/threshold`);
  return getJSON(response);
}

export async function setThreshold(value) {
  const response = await fetch(`${API_BASE}/threshold`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });

  return getJSON(response);
}

export async function getStats() {
  const response = await fetch(`${API_BASE}/stats`);
  return getJSON(response);
}

export async function getModelStatus() {
  const response = await fetch(`${API_BASE}/model-status`);
  return getJSON(response);
}

function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(",");

  const mime =
    header.match(/:(.*?);/)?.[1] || "image/jpeg";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}