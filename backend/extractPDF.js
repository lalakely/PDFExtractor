pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

async function extractPDF() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file || file.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF.');
        return;
    }

    const output = document.getElementById('output');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    output.innerHTML = '';
    loadingIndicator.style.display = 'block';

    try {
        const reader = new FileReader();
        
        reader.onload = async function(event) {
            try {
                const arrayBuffer = event.target.result;
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                
                loadingTask.onProgress = function(progressData) {
                    if (progressData.total > 0) {
                        const percent = (progressData.loaded / progressData.total * 100).toFixed(0);
                        loadingIndicator.textContent = `Chargement du PDF: ${percent}%`;
                    }
                };
                
                const pdf = await loadingTask.promise;
                loadingIndicator.textContent = 'Extraction du contenu...';
                
                let fullText = '';
                let firstPageContent = '';
                const pagesWithNotice = [];
                
                const firstPage = await pdf.getPage(1);
                const firstPageTextContent = await firstPage.getTextContent();
                const fullFirstPageText = firstPageTextContent.items.map(item => item.str).join(' ');
                
                const startFirstPage = 'PERMIS DE CONSTRUIRE';
                const endFirstPage = 'PLAN DU DOSSIER';
                
                let startIndexFirstPage = fullFirstPageText.indexOf(startFirstPage);
                let endIndexFirstPage = fullFirstPageText.indexOf(endFirstPage);
                
                if (startIndexFirstPage === -1) {
                    const regex = /permis\s+de\s+construire/i;
                    const match = regex.exec(fullFirstPageText);
                    if (match) startIndexFirstPage = match.index;
                }
                
                if (endIndexFirstPage === -1) {
                    const regex = /plan\s+du\s+dossier/i;
                    const match = regex.exec(fullFirstPageText);
                    if (match) endIndexFirstPage = match.index;
                }
                
                firstPageContent = '';
                if (startIndexFirstPage === -1) {
                    firstPageContent = 'Section "PERMIS DE CONSTRUIRE" non trouvée dans la première page.';
                } else if (endIndexFirstPage === -1) {
                    firstPageContent = fullFirstPageText.substring(startIndexFirstPage);
                } else {
                    firstPageContent = fullFirstPageText.substring(startIndexFirstPage, endIndexFirstPage + endFirstPage.length);
                }
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    loadingIndicator.textContent = `Analyse de la page ${i} sur ${pdf.numPages}...`;
                    
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    
                    if (pageText.toLowerCase().includes('notice descriptive')) {
                        pagesWithNotice.push(i);
                        fullText += `[PAGE ${i}] ${pageText} `;
                    }
                }
                
                if (pagesWithNotice.length === 0) {
                    loadingIndicator.style.display = 'none';
                    displayFirstPageAndNotice(firstPageContent, null);
                    return;
                }
                
                const startMarker = '3. Surfaces';
                const endMarker = '1. L\'ENVIRONNEMENT DU TERRAIN';
                
                let startIndex = fullText.indexOf(startMarker);
                let endIndex = fullText.indexOf(endMarker, startIndex);
                
                if (startIndex === -1) {
                    const regex = /3\.\s*surfaces/i;
                    const match = regex.exec(fullText);
                    if (match) startIndex = match.index;
                }
                
                if (endIndex === -1) {
                    const regex = /1\.\s*l['']environnement\s*du\s*terrain/i;
                    const match = regex.exec(fullText);
                    if (match) endIndex = match.index;
                }
                
                loadingIndicator.style.display = 'none';
                
                let extractedContent = '';
                if (startIndex === -1) {
                    extractedContent = `La section "${startMarker}" n'a pas été trouvée dans les pages contenant "notice descriptive".`;
                } else if (endIndex === -1 || endIndex <= startIndex) {
                    extractedContent = fullText.substring(startIndex);
                } else {
                    extractedContent = fullText.substring(startIndex, endIndex);
                }
                
                displayFirstPageAndNotice(firstPageContent, {
                    pages: pagesWithNotice,
                    startMarker,
                    endMarker,
                    content: extractedContent,
                    firstPageContent: firstPageContent
                });
            } catch (error) {
                handleError(error);
            }
        };
        
        reader.onerror = function(error) {
            handleError(error);
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        handleError(error);
    }
    
    function displayFirstPageAndNotice(firstPage, noticeData) {
        const output = document.getElementById('output');
        let html = `
            <div class="extracted-content">
                <h3>Contenu de la première page :</h3>
                <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">${firstPage}</pre>
            </div>
        `;

        if (noticeData) {
            const formattedJSON = formatContent(noticeData.content, noticeData.firstPageContent);
            // Store JSON in localStorage
            try {
                localStorage.setItem('extractedPDFData', formattedJSON);
                console.log('JSON stored in localStorage under key "extractedPDFData"');
            } catch (error) {
                console.error('Error storing JSON in localStorage:', error);
                alert('Erreur lors du stockage des données dans localStorage. Vérifiez la console.');
            }

            html += `
                <div class="extracted-content" style="margin-top: 20px;">
                    <p>Pages analysées avec notice descriptive: ${noticeData.pages.join(', ')}</p>
                    <p>Contenu extrait entre <strong>"${noticeData.startMarker}"</strong> et <strong>"${noticeData.endMarker}"</strong> :</p>
                    <h3>Texte brut extrait de la notice descriptive :</h3>
                    <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">${noticeData.content}</pre>
                    <h3>Données structurées :</h3>
                    <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${formattedJSON}</pre>
                </div>
            `;
        } else {
            html += `
                <div class="extracted-content" style="margin-top: 20px;">
                    <p>Aucune page contenant "notice descriptive" n'a été trouvée.</p>
                </div>
            `;
        }

        html += `<button onclick="copyToClipboard()">Copier le contenu</button>`;
        output.innerHTML = html;
        
        window.extractedContent = noticeData ? noticeData.content : firstPage;
    }
    
    function formatContent(content, firstPageContent) {
        try {
            const data = {
                informations_generales: {
                    type_projet: "",
                    adresse_projet: {
                        adresse: "",
                        numero: "",
                        rue: "",
                        code_postal: "",
                        ville: ""
                    },
                    beneficiaire: {
                        nom: "",
                        prenom: "",
                        adresse: "",
                        numero: "",
                        rue: "",
                        code_postal: "",
                        ville: ""
                    },
                    maitre_ouvrage: {
                        nom: "",
                        prenom: "",
                        adresse: "",
                        numero: "",
                        rue: "",
                        code_postal: "",
                        ville: ""
                    }
                },
                sections: {}
            };

            if (firstPageContent) {
                const typeProjetMatch = firstPageContent.match(/PERMIS DE CONSTRUIRE\s+(.*?)(?=\s+ADRESSE DU PROJET|$)/i);
                if (typeProjetMatch && typeProjetMatch[1]) {
                    data.informations_generales.type_projet = typeProjetMatch[1].trim();
                }

                const adresseMatch = firstPageContent.match(/ADRESSE DU PROJET\s+(.*?)(?=\s+\d{5}\s+|\s+BENEFICIAIRE|$)/i);
                const codePostalMatch = firstPageContent.match(/ADRESSE DU PROJET.*?(\d{5})\s+([A-Z][A-Za-z\s\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+)(?=\s+BENEFICIAIRE|$)/i);

                if (adresseMatch && adresseMatch[1]) {
                    const adresseComplete = adresseMatch[1].trim();
                    data.informations_generales.adresse_projet.adresse = adresseComplete;
                    
                    const rueMatch = adresseComplete.match(/^(\d+\w*(?:bis|ter)?)\s+(.*)$/i);
                    if (rueMatch) {
                        data.informations_generales.adresse_projet.numero = rueMatch[1].trim();
                        data.informations_generales.adresse_projet.rue = rueMatch[2].trim();
                    } else {
                        data.informations_generales.adresse_projet.rue = adresseComplete;
                    }
                }
                if (codePostalMatch) {
                    data.informations_generales.adresse_projet.code_postal = codePostalMatch[1];
                    data.informations_generales.adresse_projet.ville = codePostalMatch[2].trim();
                }

                const beneficiaireMatch = firstPageContent.match(/BENEFICIAIRE:\s+(.*?)(?=\s+\d+\s+|$)/i);
                const beneficiaireAdresseMatch = firstPageContent.match(/BENEFICIAIRE:.*?(\d+.*?)(?=\s+\d{5}\s+|\s+MAITRE|$)/i);
                const beneficiaireVilleMatch = firstPageContent.match(/BENEFICIAIRE:.*?(\d{5})\s+([A-Z][A-Za-z\s\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+)(?=\s+MAITRE|$)/i);

                if (beneficiaireMatch && beneficiaireMatch[1]) {
                    const nomComplet = beneficiaireMatch[1].trim();
                    const nomParts = nomComplet.split(' ');
                    if (nomParts.length > 1) {
                        data.informations_generales.beneficiaire.prenom = nomParts[0];
                        data.informations_generales.beneficiaire.nom = nomParts.slice(1).join(' ');
                    } else {
                        data.informations_generales.beneficiaire.nom = nomComplet;
                    }
                }

                if (beneficiaireAdresseMatch && beneficiaireAdresseMatch[1]) {
                    const adresseComplete = beneficiaireAdresseMatch[1].trim();
                    data.informations_generales.beneficiaire.adresse = adresseComplete;
                    const rueMatch = adresseComplete.match(/^(\d+\w*(?:bis|ter)?)\s+(.*)$/i);
                    if (rueMatch) {
                        data.informations_generales.beneficiaire.numero = rueMatch[1].trim();
                        data.informations_generales.beneficiaire.rue = rueMatch[2].trim();
                    } else {
                        data.informations_generales.beneficiaire.rue = adresseComplete;
                    }
                }

                if (beneficiaireVilleMatch) {
                    data.informations_generales.beneficiaire.code_postal = beneficiaireVilleMatch[1];
                    data.informations_generales.beneficiaire.ville = beneficiaireVilleMatch[2].trim();
                }

                const moMatch = firstPageContent.match(/MAITRE D['']OUVRAGE:\s+(.*?)(?=\s+\d+\s+|$)/i);
                const moAdresseMatch = firstPageContent.match(/MAITRE D['']OUVRAGE:.*?(\d+.*?)(?=\s+\d{5}\s+|\s+PLAN|$)/i);
                const moVilleMatch = firstPageContent.match(/MAITRE D['']OUVRAGE:.*?(\d{5})\s+([A-Z][A-Za-z\s\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+?)(?=\s+PLAN\s+DU\s+DOSSIER|$)/i);

                if (moMatch && moMatch[1]) {
                    const nomComplet = moMatch[1].trim();
                    const nomParts = nomComplet.split(' ');
                    if (nomParts.length > 1) {
                        data.informations_generales.maitre_ouvrage.prenom = nomParts[0];
                        data.informations_generales.maitre_ouvrage.nom = nomParts.slice(1).join(' ');
                    } else {
                        data.informations_generales.maitre_ouvrage.nom = nomComplet;
                    }
                }

                if (moAdresseMatch && moAdresseMatch[1]) {
                    const adresseComplete = moAdresseMatch[1].trim();
                    data.informations_generales.maitre_ouvrage.adresse = adresseComplete;
                    const rueMatch = adresseComplete.match(/^(\d+\w*(?:bis|ter)?)\s+(.*)$/i);
                    if (rueMatch) {
                        data.informations_generales.maitre_ouvrage.numero = rueMatch[1].trim();
                        data.informations_generales.maitre_ouvrage.rue = rueMatch[2].trim();
                    } else {
                        data.informations_generales.maitre_ouvrage.rue = adresseComplete;
                    }
                }

                if (moVilleMatch) {
                    data.informations_generales.maitre_ouvrage.code_postal = moVilleMatch[1];
                    data.informations_generales.maitre_ouvrage.ville = moVilleMatch[2].trim();
                }
            }

            const dataSections = {
                parcelle: {},
                avant_travaux: {},
                apres_travaux: {}
            };

            const extractNumber = (text, patterns) => {
                if (!Array.isArray(patterns)) {
                    patterns = [patterns];
                }
                
                for (const pattern of patterns) {
                    try {
                        const match = text.match(pattern);
                        if (match && match[1]) {
                            const value = match[1]
                                .replace(/\s+/g, '')
                                .replace(',', '.');
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed)) {
                                return parsed;
                            }
                        }
                    } catch (e) {
                        console.warn(`Pattern non trouvé: ${pattern}`);
                    }
                }
                return 0;
            };

            const parcellePatterns = [
                /Parcelle([^:]+):([^m²]+)m²/i,
                /Parcelle\s+(\d+\s+Section\s+\d+)\s*:\s*(\d+(?:[,.]\d+)?)/i,
                /Parcelle\s+(\d+)\s+Section\s+(\d+)\s*:\s*(\d+(?:[,.]\d+)?)/i
            ];

            let parcelleFound = false;
            for (const pattern of parcellePatterns) {
                const match = content.match(pattern);
                if (match) {
                    if (match.length === 3) {
                        dataSections.parcelle.reference = match[1].trim();
                        dataSections.parcelle.surface = parseFloat(match[2].trim().replace(',', '.'));
                    } else if (match.length === 4) {
                        dataSections.parcelle.reference = `${match[1]} Section ${match[2]}`.trim();
                        dataSections.parcelle.surface = parseFloat(match[3].trim().replace(',', '.'));
                    }
                    parcelleFound = true;
                    break;
                }
            }

            if (!parcelleFound) {
                const simpleMatch = content.match(/Parcelle(.*?)(?=\s*m²)/i);
                if (simpleMatch) {
                    const fullText = simpleMatch[1];
                    const lastColon = fullText.lastIndexOf(':');
                    if (lastColon !== -1) {
                        dataSections.parcelle.reference = fullText.substring(0, lastColon).trim();
                        const surfaceStr = fullText.substring(lastColon + 1).trim();
                        dataSections.parcelle.surface = parseFloat(surfaceStr.replace(',', '.'));
                    }
                }
            }

            const surfacePatterns = {
                surface_emprise_sol: [
                    /Surface\s+d['']emprise\s+au\s+sol[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Emprise\s+au\s+sol[^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ],
                espace_pleine_terre: [
                    /Espace\s+en\s+pleine\s+terre[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Surface\s+végétalisée[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Pleine\s+terre[^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ],
                surface_gravillonnee: [
                    /Surface\s+gravillon(?:n[ée]e)?[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Graviers?[^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ],
                surface_piscine: [
                    /Piscine[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Bassin[^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ],
                surface_pavee: [
                    /Surface\s+pav[ée]e[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Surface\s+macadamisée[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Pav[ée][^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ],
                surface_plancher: [
                    /Surface\s+de\s+plancher[^=]*=\s*(\d+(?:[,.]\d+)?)/i,
                    /Surface\s+plancher[^=]*=\s*(\d+(?:[,.]\d+)?)/i
                ]
            };

            const avantMatch = content.match(/Avant\s+r[ée]alisation\s+des\s+travaux[\s\S]+?(?=Apr[èe]s\s+r[ée]alisation\s+des\s+travaux|$)/i);
            if (avantMatch) {
                const avantText = avantMatch[0];
                dataSections.avant_travaux = {};
                
                for (const [key, patterns] of Object.entries(surfacePatterns)) {
                    dataSections.avant_travaux[key] = extractNumber(avantText, patterns);
                }

                const placePatterns = [
                    /Place\s+de\s+stationnement\s*:\s*(\d+)/i,
                    /Stationnement\s*:\s*(\d+)/i,
                    /Parking\s*:\s*(\d+)/i
                ];
                
                let placesFound = false;
                for (const pattern of placePatterns) {
                    const placeMatch = avantText.match(pattern);
                    if (placeMatch) {
                        dataSections.avant_travaux.places_stationnement = parseInt(placeMatch[1]);
                        placesFound = true;
                        break;
                    }
                }
                if (!placesFound) {
                    dataSections.avant_travaux.places_stationnement = 0;
                }
            }

            const apresMatch = content.match(/Apr[èe]s\s+r[ée]alisation\s+des\s+travaux[\s\S]+/i);
            if (apresMatch) {
                const apresText = apresMatch[0];
                dataSections.apres_travaux = {};
                
                for (const [key, patterns] of Object.entries(surfacePatterns)) {
                    dataSections.apres_travaux[key] = extractNumber(apresText, patterns);
                }

                const placePatterns = [
                    /Place\s+de\s+stationnement\s*:\s*(\d+)/i,
                    /Stationnement\s*:\s*(\d+)/i,
                    /Parking\s*:\s*(\d+)/i
                ];
                
                let placesFound = false;
                for (const pattern of placePatterns) {
                    const placeMatch = apresText.match(pattern);
                    if (placeMatch) {
                        dataSections.apres_travaux.places_stationnement = parseInt(placeMatch[1]);
                        placesFound = true;
                        break;
                    }
                }
                if (!placesFound) {
                    dataSections.apres_travaux.places_stationnement = 0;
                }
            }

            const hasData = Object.keys(dataSections.avant_travaux).length > 0 || 
                          Object.keys(dataSections.apres_travaux).length > 0;

            if (!hasData) {
                throw new Error("Aucune donnée n'a pu être extraite");
            }

            const sections = ['avant_travaux', 'apres_travaux'];
            const requiredProps = [
                'surface_emprise_sol',
                'espace_pleine_terre',
                'surface_gravillonnee',
                'surface_piscine',
                'surface_pavee',
                'surface_plancher',
                'places_stationnement'
            ];

            sections.forEach(section => {
                if (dataSections[section]) {
                    requiredProps.forEach(prop => {
                        if (dataSections[section][prop] === null || dataSections[section][prop] === undefined) {
                            dataSections[section][prop] = 0;
                        }
                    });
                }
            });

            const parcelleSimpleMatch = content.match(/Parcelle\s*(.*?)\s*:\s*(.*?)\s*(?:m²|m\^2)/i);
            if (parcelleSimpleMatch) {
                let rawRef = parcelleSimpleMatch[1].trim();
                rawRef = rawRef.replace(/^s\s*Parcelle\s*/i, '').trim();

                dataSections.parcelle.reference = rawRef;
                dataSections.parcelle.surface = parseFloat(parcelleSimpleMatch[2].replace(',', '.').replace(/\s/g, ''));
            } else {
                dataSections.parcelle = {
                    reference: "Non spécifié",
                    surface: 0
                };
            }

            data.sections = dataSections;

            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error("Erreur lors de l'extraction des données:", error);
            return "Erreur lors de l'extraction des données. Vérifiez le format du contenu.";
        }
    }
    
    function handleError(error) {
        loadingIndicator.style.display = 'none';
        output.innerHTML = `Erreur lors de l'extraction du PDF: ${error.message}`;
        console.error("Détail de l'erreur:", error);
    }
}

function copyToClipboard() {
    if (window.extractedContent) {
        navigator.clipboard.writeText(window.extractedContent)
            .then(() => alert("Contenu copié dans le presse-papiers!"))
            .catch(err => console.error("Erreur lors de la copie: ", err));
    }
}