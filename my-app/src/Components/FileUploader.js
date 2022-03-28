import React, { useState, useEffect, createRef } from 'react';
import ProgressBar from './ProgressBar';
import { FaDownload, FaRegTrashAlt } from "react-icons/fa";
import prettyBytes from 'pretty-bytes';

function FileUploader(props) {
    const [progress, setProgress] = useState("0%");
    const [selectedFile, setSelectedFile] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [errorTypeMsg, setErrorTypeMsg] = useState('');
    const [tempUI, setTempUI] = useState([]);

    let { sel, onFileName } = props; 
    let files = [];
    const fileInput = createRef();

    const processFiles = () => { 
        files = fileInput.current.files;
        uploadFiles(files)
    }
    const onClickUpload = () => {
        if (sel !== '') {
            document.getElementById(props.clientType).click();
        } else {
            setErrorMsg('Please select Report Type.');
        }
    }
    useEffect(() => {
        if (selectedFile) {
            tempUI.pop();
            let temp = fileData(selectedFile);
            setTempUI([...tempUI, temp]);
    
        } else {
            // return (
            //     <div>
            //         <br />
            //         <h4>Choose before Pressing the Upload button</h4>
            //     </div>
            // );
        }

    }, [progress]);

    const fileData = (selectedFile1) => {
        return (
            <table className='pdfList' key={selectedFile1[0].lastModified}>
                <tbody>
                {Object.keys(selectedFile1).map((key, index) => (
                    <tr id={selectedFile1[key].lastModified} key={key}>
                        <td style={{'width': '48px'}}>
                            <img src='./file-type-icon-pdf.png'></img>
                        </td>
                        <td className='pdfName'>
                            <div>
                                <a onClick={() => showFile(selectedFile1[key].name)}>{selectedFile1[key].name}</a>
                            </div> 
                            <div className='pdfSize'>
                                {progress === "100%" && prettyBytes(selectedFile1[key].size)}
                                {progress === "100%" || <ProgressBar progress={progress} />}
                                {progress === "100%" || 'Uploading'}
                            </div>
                        </td>
                        <td className='downloadPdf' onClick={() => downloadFile(selectedFile1[key].name)} style={{'width': '25px'}}>
                            <FaDownload /> 
                            <span className="tooltip">Download {selectedFile1[key].name}</span>
                        </td>
                        <td className='removePdf' onClick={() => removeFile(selectedFile1[key].name, selectedFile1[key].lastModified)} style={{'width': '25px'}}>
                            <FaRegTrashAlt />
                            <span className="tooltip">Remove {selectedFile1[key].name}</span>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        );
    };
    const downloadFile = (fileName) => { 
        fetch('/downloadFile?fileName='+fileName)
            .then(response => {
                response.blob().then(blob => {
                    let url = window.URL.createObjectURL(blob);
                    let a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    a.click();
                });
        });
    }
    const showFile = (fileName) => { 
        fetch('/showFile?fileName='+fileName)
            .then(response => {
                response.blob().then(blob => {
                    let url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank')
                });
        });
    }
    const removeFile = (fileName, parentId) => { 
        fetch('/removeFile?fileName='+fileName)
            .then(response => {
                if(response.status === 200) {
                    document.getElementById(parentId).remove();
                }
        });
    }
    const showProgress = (evt) => {
        let percentage = (((evt.loaded / evt.total) * 100)) + "%";
        // console.log("per: ", percentage);
        setProgress(percentage);
    }

    const dragOver = (e) => {
        e.preventDefault();
    }
    
    const dragEnter = (e) => {
        e.preventDefault();
    }
    
    const dragLeave = (e) => {
        e.preventDefault();
    }
    
    const fileDrop = (e) => {
        e.preventDefault();
        if (sel !== '') {
            const files = e.dataTransfer.files;
            uploadFiles(files)
        } else {
            setErrorMsg('Please select Report Type.');
        }
    }
    const uploadFiles = (files) => {
        var request = new XMLHttpRequest();
        if (files.length === 0) return;
        var checkFileType = true;
        for (var file = 0; file < files.length; file++) {
            if(files[file].type !== 'application/pdf') {
                checkFileType = false;
            }
        }
        if(checkFileType) {
            setProgress("0%");
            setSelectedFile(files);
            setTempUI([...tempUI, ""]);
            request.upload.addEventListener("progress", showProgress);
            request.open("POST", "/uploadFile", true);
            var formData = new FormData();
            for (var file = 0; file < files.length; file++) {
                formData.append("file" + file, files[file], files[file].name);
                onFileName(files[file].name);
            }
            request.send(formData);
            setErrorMsg('');
            setErrorTypeMsg('');
        } else {
            setErrorTypeMsg('Please select PDF files');
        }        
    }

    return <>   
        <input type="file" accept="application/pdf" multiple={true} id={props.clientType} style={{ display: 'none' }} ref={fileInput} onChange={processFiles} />
        <div 
            className='dragDrop'
            onDragOver={dragOver}
            onDragEnter={dragEnter}
            onDragLeave={dragLeave}
            onDrop={fileDrop}
        >
            <button 
                className='uploadBtn' 
                onClick={onClickUpload}
            >Upload</button> or drag files here
        </div>
        {tempUI}
        <p className="errorMsg">{sel === '' && errorMsg}</p>  
        <p className="errorTypeMsg">{errorTypeMsg !== '' && errorTypeMsg}</p>  
    </>

}

export default FileUploader;