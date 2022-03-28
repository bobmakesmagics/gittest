import React, { useState, useEffect } from 'react';
import '../index.css';
import FileUpload from './FileUploader';
import convertFiles from './func.js'

function IndexMod() {

    const [sel, setSel] = useState('');

    let myfiles = [];
    
    const onSelect =  (e) => {
        setSel(e.target.value);
    }

    const onFileName = (filename) => {
        myfiles.push(filename);
    }

    const controlFiles = async () => {
        let fileNum = myfiles.length - 1;
        if(fileNum >= 0){
            convertFiles(fileNum, myfiles);
        }
    }
    useEffect(() => {
        if (window.performance) {
            if (String(window.performance.getEntriesByType("navigation")[0].type) === "reload") {
                fetch('/init')
                    .then(response => {
                        console.log(response);
                })
            }
        }
    }, []);
    return <>
        <div className='main' style={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <div className='header'>
                <h2>JSON reader</h2>
            </div>
            <div className='content'>
                <div>
                    <label>Report Type</label>
                </div>
                <div>
                    <select id="reportType" onChange={(e) => onSelect(e)}>
                        <option></option>
                        <option value="Experian.com">Experian.com</option>
                        <option value="Score Sense">Score Sense</option>
                    </select>
                </div>
                <div className='container'>
                    <div className='part'>
                        <div>
                            <label>Equifax</label>
                        </div>
                        <div>
                            <FileUpload sel={sel} onFileName={onFileName} clientType='Equifax' />
                        </div>   
                    </div>
                    <div className='part'>
                        <div>
                            <label>Experian</label>
                        </div>
                        <div>
                            <FileUpload sel={sel} onFileName={onFileName} clientType='Experian' />
                        </div>
                    </div>
                    <div className='part'>
                        <div>
                            <label>Transunion</label>
                        </div>
                        <div>
                            <FileUpload sel={sel} onFileName={onFileName} clientType='Transunion' />
                        </div> 
                    </div>
                </div>
                <div>
                <button className='submitBtn' onClick={controlFiles}>Submit</button>
                </div>
            </div>
        </div> 
    </>

}

export default IndexMod;