const convertFiles = async (index, files) => {
        if (index < 0) {
            return 0;
        } else {

            await fetch('/convertFiles?fileName='+files[index])
                .then(response => {
                    response.blob().then(blob => {
                        console.log(blob);
                        let url = window.URL.createObjectURL(blob);
                        let a = document.createElement('a');
                        a.href = url;
                        a.download = files[index].replace('.pdf', '.json');
                        a.click();
                        
                        setTimeout(() => {
                            convertFiles(index-1, files);
                        }, 3000);
                    });
                    
            });

        }
}

export default convertFiles;