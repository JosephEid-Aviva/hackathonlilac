import React from "react";

export const Header = () => {
  return (
    <div style={{ display: "flex", height: "3rem" }}>
      <img src="mycontact.jpg" alt="logo" />
      <h1
        style={{
          backgroundColor: "#c9e0f5",
          marginBottom: 0,
          padding: "0.5rem",
          fontSize: "2rem",
        }}
      >
        Mrs. Jane Doe
      </h1>
      <h2
        style={{
          color: "#176FC1",
          textDecoration: "underline grey",
          fontSize: "1rem",
          marginLeft: "1rem",
          marginBottom: 0,
          verticalAlign: "bottom",
          paddingTop: "1.5rem",
          fontStyle: "bold",
        }}
      >
        Start a new conversation
      </h2>
    </div>
  );
};
