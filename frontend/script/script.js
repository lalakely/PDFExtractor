 // Initialize PDF.js worker
 pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
 // DOM Elements
 const dropZone = document.getElementById('dropZone');
 const fileInput = document.getElementById('fileInput');
 const outputDiv = document.getElementById('output');
 const loadingIndicator = document.getElementById('loadingIndicator');
 const pdfPreview = document.getElementById('pdfPreview');
 const pdfThumbnail = document.getElementById('pdfThumbnail');
 const pdfFilename = document.getElementById('pdfFilename');
 const removePdf = document.getElementById('removePdf');
 const extractBtn = document.getElementById('extractBtn');
 const translateBtn = document.getElementById('translateBtn');
 
 let currentPdfFile = null;
 


 
 // Event Listeners
 dropZone.addEventListener('click', (e) => {
   // Prevent click if we already have a PDF
   if (!dropZone.classList.contains('has-pdf')) {
     fileInput.click();
   }
 });

 dropZone.addEventListener('dragover', (e) => {
   e.preventDefault();
   // Only allow dragover if we don't have a PDF already
   if (!dropZone.classList.contains('has-pdf')) {
     dropZone.classList.add('dragover');
   }
 });

 dropZone.addEventListener('dragleave', () => {
   dropZone.classList.remove('dragover');
 });

 dropZone.addEventListener('drop', (e) => {
   e.preventDefault();
   dropZone.classList.remove('dragover');
   
   // Only process the drop if we don't have a PDF already
   if (!dropZone.classList.contains('has-pdf')) {
     const files = e.dataTransfer.files;
     if (files.length && files[0].type === 'application/pdf') {
       fileInput.files = files;
       handlePdfSelection(files[0]);
     } else {
       showNotification('Veuillez déposer un fichier PDF valide.');
     }
   }
 });

 fileInput.addEventListener('change', () => {
   if (fileInput.files.length && fileInput.files[0].type === 'application/pdf') {
     handlePdfSelection(fileInput.files[0]);
   } else {
     showNotification('Veuillez sélectionner un fichier PDF valide.');
   }
 });
 
 removePdf.addEventListener('click', (e) => {
   e.stopPropagation(); // Prevent triggering the dropZone click
   resetPdfUpload();
 });
 
 // Connect buttons to your existing scripts
 extractBtn.addEventListener('click', function() {
   if (!currentPdfFile) {
     showNotification('Aucun PDF sélectionné.');
     return;
   }
   
   // Show loading indicator
   loadingIndicator.style.display = 'flex';
   
   try {
     // Call your existing extractPDF function and display a preview afterwards
     extractPDF(); // Your existing function
     
     // Display PDF in preview (after a short delay to ensure processing is visible)
     setTimeout(() => {
       // Display the PDF in the preview
       const fileReader = new FileReader();
       fileReader.onload = function() {
         const pdfDataUrl = fileReader.result;
         pdfPreview.src = pdfDataUrl;
       };
       fileReader.readAsDataURL(currentPdfFile);
       
       loadingIndicator.style.display = 'none';
       
       // Make output div visible if your script populates it
       if (outputDiv.innerHTML.trim() !== '') {
         outputDiv.style.display = 'block';
         outputDiv.classList.add('pulse');
         setTimeout(() => outputDiv.classList.remove('pulse'), 1500);
       }
     }, 500);
   } catch (error) {
     loadingIndicator.style.display = 'none';
     showNotification('Erreur lors de l\'extraction: ' + error.message);
   }
 });
 
 translateBtn.addEventListener('click', function() {
   if (!currentPdfFile) {
     showNotification('Aucun PDF sélectionné.');
     return;
   }
   
   // Show loading indicator
   loadingIndicator.style.display = 'flex';
   
   try {
     // Call your existing fillPDF function
     fillPDF(); // Your existing function
     
     // Hide loading indicator and show success notification
     setTimeout(() => {
       loadingIndicator.style.display = 'none';
       showNotification('PDF traduit avec succès!', 'success');
       
       // Add pulse effect to the preview
       pdfPreview.classList.add('pulse');
       setTimeout(() => pdfPreview.classList.remove('pulse'), 1500);
     }, 500);
   } catch (error) {
     loadingIndicator.style.display = 'none';
     showNotification('Erreur lors de la traduction: ' + error.message);
   }
 });
 
 // Handle PDF file selection
 function handlePdfSelection(file) {
   currentPdfFile = file;
   
   // Update UI to show we have a PDF
   dropZone.classList.add('has-pdf');
   pdfFilename.textContent = file.name;
   
   // Enable buttons
   extractBtn.disabled = false;
   translateBtn.disabled = false;
   
   // Generate thumbnail preview
   renderPdfThumbnail(file);
 }
 
 // Reset the PDF upload state
 function resetPdfUpload() {
   currentPdfFile = null;
   dropZone.classList.remove('has-pdf');
   fileInput.value = ''; // Clear the file input
   
   // Clear the canvas
   const ctx = pdfThumbnail.getContext('2d');
   ctx.clearRect(0, 0, pdfThumbnail.width, pdfThumbnail.height);
   
   // Reset filename
   pdfFilename.textContent = '';
   
   // Disable buttons
   extractBtn.disabled = true;
   translateBtn.disabled = true;
   
   // Hide output if visible
   outputDiv.style.display = 'none';
   
   // Clear preview iframe
   pdfPreview.src = 'about:blank';
 }
 
 // Render PDF thumbnail
 function renderPdfThumbnail(pdfFile) {
   const fileReader = new FileReader();
   
   fileReader.onload = function() {
     const typedarray = new Uint8Array(this.result);
     
     // Load the PDF
     pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
       // Get the first page
       pdf.getPage(1).then(function(page) {
         const viewport = page.getViewport({ scale: 0.5 });
         
         // Set canvas dimensions
         pdfThumbnail.width = viewport.width;
         pdfThumbnail.height = viewport.height;
         
         // Render PDF page into canvas context
         const renderContext = {
           canvasContext: pdfThumbnail.getContext('2d'),
           viewport: viewport
         };
         
         page.render(renderContext);
       });
     }).catch(function(error) {
       console.error('Error rendering PDF thumbnail:', error);
       showNotification('Erreur lors de la prévisualisation du PDF.');
     });
   };
   
   fileReader.readAsArrayBuffer(pdfFile);
 }
 
 // Show notification
 function showNotification(message, type = 'error') {
   const notification = document.createElement('div');
   notification.textContent = message;
   notification.style.position = 'fixed';
   notification.style.bottom = '20px';
   notification.style.right = '20px';
   notification.style.padding = '12px 20px';
   notification.style.borderRadius = '8px';
   notification.style.color = 'white';
   notification.style.zIndex = '1000';
   notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
   notification.style.transition = 'all 0.3s ease';
   
   if (type === 'error') {
     notification.style.backgroundColor = 'var(--danger)';
   } else {
     notification.style.backgroundColor = 'var(--success)';
   }
   
   document.body.appendChild(notification);
   
   setTimeout(() => {
     notification.style.opacity = '0';
     setTimeout(() => {
       document.body.removeChild(notification);
     }, 300);
   }, 3000);
 }