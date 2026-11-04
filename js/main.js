/* Parallax — the old hero (Monet background + glass card) is gone;
   these elements may no longer exist, so everything is guarded. */

const background =
document.getElementById("background");

const heroCard =
document.querySelector(".hero-card");

let mouseX = 0;
let mouseY = 0;

let currentX = 0;
let currentY = 0;

window.addEventListener("mousemove",(e)=>{

    mouseX =
    (e.clientX / window.innerWidth - 0.5) * 100;

    mouseY =
    (e.clientY / window.innerHeight - 0.5) * 100;

});

if (background) {

    function animate(){

        currentX += (mouseX-currentX)*0.05;
        currentY += (mouseY-currentY)*0.05;

        background.style.transform =
        `translate(${currentX}px, ${currentY}px)`;

        requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener("scroll",()=>{

        const scroll = window.scrollY;

        // Hero slowly moves upward
        background.style.transform =
            `translate(${currentX}px, ${currentY - scroll*0.15}px)`;

        // Glass card moves slightly slower
        if (heroCard) {
            heroCard.style.transform =
                `translate(-50%, calc(-50% - ${scroll*0.08}px))`;
        }
    });
}
