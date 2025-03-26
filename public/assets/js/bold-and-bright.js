// bold-and-bright.js

// Wait for the DOM to finish loading
document.addEventListener("DOMContentLoaded", function () {
  // Create a disclaimer element
  const disclaimer = document.createElement("div");

  // Apply styles to the disclaimer
  disclaimer.style.backgroundColor = "#f8f9fa";
  disclaimer.style.color = "#6c757d";
  disclaimer.style.fontSize = "0.85rem";
  disclaimer.style.textAlign = "center";
  disclaimer.style.padding = "10px";
  disclaimer.style.borderTop = "1px solid #dee2e6";
  disclaimer.style.marginTop = "40px";

  // Set the disclaimer message
  disclaimer.innerText = "This website is for educational purposes only and is not an authorized recall management system for the CPSC.";

  // Append the disclaimer to the bottom of the page
  document.body.appendChild(disclaimer);
});
