const date = document.getElementById("date");

if(date){

    const today = new Date();
    date.innerHTML = today.toLocaleDateString("hu-HU");
}

function darkMode(){

    document.body.classList.toggle("light-mode");
}

const message = document.getElementById("message");
const counter = document.getElementById("counter");

if(message){

    message.addEventListener("input", function(){

        counter.innerHTML = message.value.length;
    });
}

function toggleCards(){

    const cards = document.querySelector(".row");

    if(cards.style.display === "none"){
        cards.style.display = "flex";
    }
    else{
        cards.style.display = "none";
    }
}

const form = document.getElementById("contactForm");

if(form){

form.addEventListener("submit", function(event){

    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const text = message.value.trim();

    if(name.length < 3){
        alert("Hibás névformátum!");
        return;
    }

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        alert("Hibás email cím!");
        return;
    }

    if(text.length === 0){
        alert("Kérlek, írd meg az üzenetet!");
        return;
    }

    // Az üzenet mentése: a tanár az altanar.html "Beérkezett üzenetek" részében látja
    let messages = [];
    try {
        messages = JSON.parse(localStorage.getItem("contactMessages")) || [];
        if(!Array.isArray(messages)) messages = [];
    } catch(e) {
        messages = [];
    }

    messages.push({
        id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        email: email,
        text: text,
        ts: Date.now(),
        read: false
    });

    try {
        localStorage.setItem("contactMessages", JSON.stringify(messages));
    } catch(e) {
        alert("Az üzenetet nem sikerült elmenteni (megtelt a böngésző tárhelye).");
        return;
    }

    document.getElementById("success").innerHTML = "Sikeresen elküldve!";

    form.reset();

    if(counter){
        counter.innerHTML = 0;
    }
});
}
