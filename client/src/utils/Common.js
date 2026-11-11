import React from "react";

export const formatDateToReadable = (dateString) => {
    if (!dateString) return 'Invalid date';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    const day = date.toLocaleString('en-IN', {
        day: '2-digit',
        timeZone: 'Asia/Kolkata',
    });

    const month = date.toLocaleString('en-IN', {
        month: 'long',
        timeZone: 'Asia/Kolkata',
    });

    const year = date.toLocaleString('en-IN', {
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });

    return `${day} ${month}, ${year}`; // → "25 July, 2025"
};

export const formatTodayDate = () => {
    const now = new Date(Date.now());

    const day = now.getDate().toString().padStart(2, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear();

    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert 0 → 12

    //const formatted = `${day}/${month}/${year}   ${hours}:${minutes} ${ampm}`;
    return (
        <>
            {day}/{month}/{year}
            &nbsp;&nbsp;  
            {hours}:{minutes} {ampm}
        </>
    );
    // return (
    //     <>
    //         {day}/{month}/{year}
    //         <br />  
    //         {hours}:{minutes} {ampm}
    //     </>
    //     );
}

export const formatStatus = (status) => {
    if(status){
        return status
            .replace(/_/g, ' ') // replace underscores with spaces
            .split(' ')         // split into words
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // capitalize
            .join(' ');
    } else {
        return '';
    }        
};

export const nl2br = (str) => {
    if (!str) return null;
    return str.split('\n').map((line, index) => (
        <React.Fragment key={index}>
        {line}
        <br />
        </React.Fragment>
    ));
};
