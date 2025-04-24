async function fillPDF() {
  // Load blanket.pdf from the server
  let pdfBytes;
  try {
    const response = await fetch('./blanket.pdf');
    if (!response.ok) throw new Error(`Failed to fetch blanket.pdf: ${response.statusText}`);
    pdfBytes = await response.arrayBuffer();
  } catch (error) {
    console.error('Error loading blanket.pdf:', error);
    alert('Error loading blanket.pdf. Check console for details.');
    return;
  }

  // Load JSON data from localStorage
  let jsonData;
  try {
    const storedData = localStorage.getItem('extractedPDFData');
    if (!storedData) throw new Error('No data found in localStorage under key "extractedPDFData". Please extract the PDF first.');
    jsonData = JSON.parse(storedData);
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    alert('Error loading data from localStorage. Check console for details.');
    return;
  }

  // Load the PDF with PDF-LIB.js
  let pdfDoc;
  try {
    pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  } catch (error) {
    console.error('Error loading PDF document:', error);
    alert('Error loading PDF document. Check console for details.');
    return;
  }

  const form = pdfDoc.getForm();

  // Log all form field names, types, and appearance properties for debugging
  const fields = form.getFields();
  fields.forEach(field => {
    const name = field.getName();
    const type = field.constructor.name;
    let appearance = {};
    try {
      if (field instanceof PDFLib.PDFTextField) {
        const defaultAppearance = field.acroField.getDefaultAppearance();
        appearance.textColor = defaultAppearance?.match(/(\d*\.?\d*\s+\d*\.?\d*\s+\d*\.?\d*)\s+rg/)?.[1] || 'Unknown';
        // Background color is typically set in the widget's /MK or /BS dictionary, but not directly accessible
        appearance.backgroundColor = 'Check widget properties manually';
      } else if (field instanceof PDFLib.PDFCheckBox) {
        appearance.checkmarkColor = field.acroField.getDefaultAppearance()?.match(/(\d*\.?\d*\s+\d*\.?\d*\s+\d*\.?\d*)\s+rg/)?.[1] || 'Unknown';
      }
      console.log(`Field Name: ${name}, Type: ${type}, Appearance: ${JSON.stringify(appearance)}`);
    } catch (error) {
      console.warn(`Could not retrieve appearance for field ${name}: ${error.message}`);
    }
  });

  // Utility function to safely set text fields with color preservation
  const setTextFieldSafe = (fieldName, value, textColor = [0, 0, 1]) => {
    try {
      const textField = form.getTextField(fieldName);
      textField.setText(value);

      // Set text color using appearance stream
      const widget = textField.acroField.getWidgets()[0];
      const appearanceStream = widget.getNormalAppearance() || widget.createNormalAppearance();
      const streamContent = `
        /Tx BMC
        q
        ${textColor.map(c => c.toFixed(3)).join(' ')} rg
        BT
        /Helvetica 10 Tf
        1 0 0 1 2 2 Tm
        (${PDFLib.escapePDFName(value)}) Tj
        ET
        Q
        EMC
      `;
      appearanceStream.setContent(streamContent);
      widget.setNormalAppearance(appearanceStream);

      textField.updateAppearances();
    } catch (error) {
      console.warn(`Field ${fieldName} does not exist or cannot be set: ${error.message}`);
    }
  };

  // Utility function to safely check checkboxes with color preservation
  const setCheckBoxSafe = (fieldName, shouldCheck, checkmarkColor = [0, 0, 1]) => {
    try {
      const checkBox = form.getCheckBox(fieldName);
      if (shouldCheck) {
        checkBox.check();

        // Set checkmark color using appearance stream
        const widget = checkBox.acroField.getWidgets()[0];
        const onAppearance = widget.getOnAppearance() || widget.createOnAppearance();
        const streamContent = `
          q
          ${checkmarkColor.map(c => c.toFixed(3)).join(' ')} rg
          0 0 10 10 re
          f
          Q
        `;
        onAppearance.setContent(streamContent);
        widget.setOnAppearance(onAppearance);
      }
      checkBox.updateAppearances();
    } catch (error) {
      console.warn(`Field ${fieldName} does not exist or cannot be checked: ${error.message}`);
    }
  };

  // Format numbers for French decimal notation
  const formatNumber = (num) => Number.isFinite(num) && num !== 0 ? num.toFixed(2).replace('.', ',') : '';

  // Sanitize name for filename
  const sanitizeFilename = (name) => {
    return name ? name.replace(/[^a-zA-Z0-9]/g, '_') : 'DEFAULT';
  };

  // Derive output filename from beneficiary's name
  const beneficiaryName = jsonData.informations_generales?.beneficiaire?.nom ?? 'DEFAULT';
  const outputFilename = `filled_01_PCMI_cerfa_${sanitizeFilename(beneficiaryName)}.pdf`;

  // Define colors to match blanket.pdf (assumed: blue text, blue checkmarks)
  const blueTextColor = [0, 0, 1]; // RGB blue
  const blueCheckmarkColor = [0, 0, 1]; // RGB blue for checkbox checkmarks

  // Map JSON data to PDF form fields with color settings
  try {
    // Section 1: Administrative Details
  

    // Section 2: Applicant Details
    setTextFieldSafe('D1N_nom', jsonData.informations_generales?.beneficiaire?.nom ?? '', blueTextColor);
    setTextFieldSafe('D1P_prenom', jsonData.informations_generales?.beneficiaire?.prenom ?? '', blueTextColor);
    setTextFieldSafe('D1E_pays', 'FRANCE', blueTextColor);
    setTextFieldSafe('D3N_numero', jsonData.informations_generales?.beneficiaire?.numero ?? '', blueTextColor);
    setTextFieldSafe('D3V_voie', jsonData.informations_generales?.beneficiaire?.rue ?? '', blueTextColor);
    setTextFieldSafe('D3L_localite', jsonData.informations_generales?.beneficiaire?.ville ?? '', blueTextColor);
    setTextFieldSafe('D3C_code', jsonData.informations_generales?.beneficiaire?.code_postal ?? '', blueTextColor);
    setTextFieldSafe('D3T_telephone', jsonData.informations_generales?.beneficiaire?.telephone ?? '', blueTextColor);
    setTextFieldSafe('D5GE1_email', jsonData.informations_generales?.beneficiaire?.email ?? '', blueTextColor);
    setCheckBoxSafe('D5A_acceptation', !!jsonData.informations_generales?.beneficiaire?.email, blueCheckmarkColor);

    // Section 3.1: Terrain Address
    setTextFieldSafe('T2Q_numero', jsonData.informations_generales?.adresse_projet?.numero ?? '', blueTextColor);
    setTextFieldSafe('T2V_voie', jsonData.informations_generales?.adresse_projet?.rue ?? '', blueTextColor);
    setTextFieldSafe('T2L_localite', jsonData.informations_generales?.beneficiaire?.ville ?? '', blueTextColor);
    setTextFieldSafe('T2C_code', jsonData.informations_generales?.adresse_projet?.code_postal ?? '', blueTextColor);
    setTextFieldSafe('T2F_prefixe', '000', blueTextColor);

    // Section 3.1: Cadastral Details
    const cadastralRef = jsonData.sections?.parcelle?.reference?.split(' ') ?? ['', ''];
    setTextFieldSafe('T2S_section', cadastralRef[0], blueTextColor);
    setTextFieldSafe('T2N_numero', cadastralRef[1], blueTextColor);
    setTextFieldSafe('T2T_superficie', jsonData.sections?.parcelle?.surface?.toString() ?? '', blueTextColor);
    setTextFieldSafe('D5T_total', jsonData.sections?.parcelle?.surface?.toString() ?? '', blueTextColor);

    // Section 4.2: Project Description
    setTextFieldSafe('C2ZD1_description', jsonData.informations_generales?.type_projet ?? '', blueTextColor);
    setCheckBoxSafe('C5ZK1_extension', jsonData.informations_generales?.type_projet?.toUpperCase().includes('EXTENSION'), blueCheckmarkColor);

    // Section 4.3: Project Details
    setCheckBoxSafe('C5ZE1_piscine', (jsonData.sections?.avant_travaux?.surface_piscine ?? 0) > 0, blueCheckmarkColor);

    // Section 4.4 & 4.5: Surface Table
    const avantPlancher = jsonData.sections?.avant_travaux?.surface_plancher ?? 0;
    const apresPlancher = jsonData.sections?.apres_travaux?.surface_plancher ?? 0;
    const plancherDiff = apresPlancher - avantPlancher;

    setTextFieldSafe('W2LA1', formatNumber(avantPlancher), blueTextColor);
    const w2lb1Value = plancherDiff > 0 ? formatNumber(plancherDiff) : '';
    setTextFieldSafe('W2LB1', w2lb1Value, blueTextColor);
    setTextFieldSafe('W2SB1', w2lb1Value, blueTextColor);
    const w2ld1Value = plancherDiff < 0 ? formatNumber(-plancherDiff) : '';
    setTextFieldSafe('W2LD1', w2ld1Value, blueTextColor);
    const w2lf1Raw = avantPlancher + (plancherDiff > 0 ? plancherDiff : 0) - (plancherDiff < 0 ? -plancherDiff : 0);
    const w2lf1Value = formatNumber(w2lf1Raw);
    setTextFieldSafe('W2LF1', w2lf1Value, blueTextColor);
    setTextFieldSafe('W2SF1', w2lf1Value, blueTextColor);

    // Surface d'Emprise au Sol calculations
    const empriseSolAvant = jsonData.sections?.avant_travaux?.surface_emprise_sol ?? 0;
    const empriseSolApres = jsonData.sections?.apres_travaux?.surface_emprise_sol ?? 0;
    const empriseSolDiff = empriseSolApres - empriseSolAvant;

    setTextFieldSafe('W3ES1_avanttravaux', formatNumber(empriseSolAvant), blueTextColor);
    setTextFieldSafe('W3ES2_creee', empriseSolDiff > 0 ? formatNumber(empriseSolDiff) : '', blueTextColor);
    setTextFieldSafe('W3ES3_supprimee', empriseSolDiff < 0 ? formatNumber(-empriseSolDiff) : '', blueTextColor);

    // Section 7: Additional Regulations
    setCheckBoxSafe('X2R_remarquable', false, blueCheckmarkColor);
    setCheckBoxSafe('X1L_legislation', false, blueCheckmarkColor);
    setCheckBoxSafe('X1U_raccordement', false, blueCheckmarkColor);

    // Section 8: Applicant Declaration
    setCheckBoxSafe('P8EA1', true, blueCheckmarkColor);
    setCheckBoxSafe('P8DB1', true, blueCheckmarkColor);

  } catch (error) {
    console.error('Error filling form fields:', error);
    alert('Error filling form fields. Check console for details.');
    return;
  }

  // Flatten the form to preserve static content and appearances
  try {
    form.flatten();
  } catch (error) {
    console.warn('Error flattening form:', error.message);
  }

  // Save the modified PDF
  let modifiedPdfBytes;
  try {
    modifiedPdfBytes = await pdfDoc.save();
  } catch (error) {
    console.error('Error saving PDF:', error);
    alert('Error saving PDF. Check console for details.');
    return;
  }

  // Display the modified PDF in the iframe
  try {
    const pdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    document.getElementById('pdfPreview').src = pdfUrl;

    // Trigger download of the modified PDF
    const downloadLink = document.createElement('a');
    downloadLink.href = pdfUrl;
    downloadLink.download = outputFilename;
    downloadLink.click();

    // Clean up URL object to prevent memory leaks
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
  } catch (error) {
    console.error('Error displaying or downloading PDF:', error);
    alert('Error displaying or downloading PDF. Check console for details.');
  }
}