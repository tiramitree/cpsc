// bold-and-bright.js
// Dynamically injects footer disclaimer to all pages on load

document.addEventListener("DOMContentLoaded", function () {
  // Create footer disclaimer element
  const disclaimer = document.createElement("footer");
  disclaimer.className = "text-muted small text-center mt-5";
  disclaimer.style.backgroundColor = "#f8f9fa";
  disclaimer.style.padding = "15px";
  disclaimer.style.borderTop = "1px solid #ccc";
  disclaimer.style.position = "relative";
  disclaimer.style.width = "100%";

  disclaimer.innerText = "This website is for educational purposes only and is not an authorized recall management system for the CPSC.";

  // Add to page bottom
  document.body.appendChild(disclaimer);
});
