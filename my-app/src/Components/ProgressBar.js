import React from 'react';

function ProgressBar(props) {
    return <div style={{ height: '7px', width: '220px', backgroundColor: 'whitesmoke' }}>
        <div style={{ height: '100%', width: props.progress, backgroundColor: 'blue' }}></div>
    </div>;
}

export default ProgressBar;