window.addEventListener('load', function () {
    // Get number of wins to determine bone count
    const wins = parseInt(localStorage.getItem('gameWins') || '0');
    const extraBones = wins * 2; // Add 2 extra bones per win
    // Reduce time limit based on number of wins
    const timeReduction = wins * 2; // Reduce by 2 seconds per win
    const baseTime = 30;
    let fatherSleepTime = Math.max(baseTime - timeReduction, 10); // Don't go below 10 seconds
    let gameStartTime = Date.now();
    let gameOver = false;

    // Define cave first, before it's used in generateBonePosition
    const cave = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        width: 200,
        height: 150
    };

    // Game state - Random bone locations
    let dogPosition = { x: 50, y: 50 };

    // Function to generate valid bone position
    function generateBonePosition() {
        const fatherPosition = {
            x: window.innerWidth - 100,
            y: window.innerHeight - 100
        };
        const fatherRadius = 100; // Increased safe distance from father
        const margin = 50; // Margin from edges
        let x, y, distanceFromFather;
        let isValidPosition = false;

        while (!isValidPosition) {
            x = Math.random() * (window.innerWidth - 2 * margin) + margin;
            y = Math.random() * (window.innerHeight - 2 * margin) + margin;
            distanceFromFather = Math.hypot(x - fatherPosition.x, y - fatherPosition.y);
            
            // Check if position is valid (away from father AND not in cave)
            isValidPosition = distanceFromFather >= fatherRadius && !isOverCave(x, y);
        }

        return { x, y };
    }

    // Create initial bones at valid positions
    const initialBones = [
        generateBonePosition(),
        generateBonePosition(),
        generateBonePosition(),
        generateBonePosition()
    ];

    // Add extra bones at valid positions
    for (let i = 0; i < extraBones; i++) {
        initialBones.push(generateBonePosition());
    }
    let bones = initialBones.map(bone => {
        // Draw bone shape
        return {
            ...bone,
            draw: function (ctx) {
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'gray';
                ctx.lineWidth = 2;

                // Draw main bone rectangle
                ctx.fillRect(this.x - 15, this.y - 5, 30, 10);
                ctx.strokeRect(this.x - 15, this.y - 5, 30, 10);

                // Draw bone ends (ovals)
                ctx.beginPath();
                ctx.ellipse(this.x - 15, this.y - 5, 7, 4, Math.PI/4, 0, Math.PI * 2);
                ctx.ellipse(this.x - 15, this.y + 5, 7, 4, -Math.PI/4, 0, Math.PI * 2);
                ctx.ellipse(this.x + 15, this.y - 5, 7, 4, -Math.PI/4, 0, Math.PI * 2);
                ctx.ellipse(this.x + 15, this.y + 5, 7, 4, Math.PI/4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        };
    });

    // Add these variables near the top with other game state variables
    let isJumping = false;
    let jumpStartPosition = null;
    let jumpTargetPosition = null;
    let jumpStartTime = null;
    const JUMP_DURATION = 500; // 500ms for the jump animation

    // Add these audio elements near the top with other game state variables
    const jumpSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2887/2887-preview.mp3'); // Short pop/boing
    const boneCollectSound = new Audio('https://assets.mixkit.co/active_storage/sfx/146/146-preview.mp3'); // Quick munch
    const fatherWakeSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1396/1396-preview.mp3'); // Short alarm beep

    // Adjust volume and add function to control sound duration
    jumpSound.volume = 0.3;
    boneCollectSound.volume = 0.4;
    fatherWakeSound.volume = 0.3;

    // Replace the fixed canvas creation with fullscreen setup
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(canvas);

    // Function to update canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    // Initial resize and add event listener for window resizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Update father position to be in bottom right corner
    const fatherPosition = {
        x: window.innerWidth - 100,
        y: window.innerHeight - 100
    };

    const ctx = canvas.getContext('2d');

    // Function to play sound with duration limit
    function playShortSound(sound) {
        sound.currentTime = 0;
        sound.play();
        setTimeout(() => {
            sound.pause();
            sound.currentTime = 0;
        }, 300); // Stop after 300ms
    }

    // Handle keyboard input
    document.addEventListener('keydown', function (e) {
        if (gameOver) return;

        const speed = 5;
        switch (e.key) {
            case 'ArrowUp':
                dogPosition.y -= speed;
                break;
            case 'ArrowDown':
                dogPosition.y += speed;
                break;
            case 'ArrowLeft':
                dogPosition.x -= speed;
                break;
            case 'ArrowRight':
                dogPosition.x += speed;
                break;
        }

        checkBoneCollection();
        checkFatherCollision();
        // Only check poodle collision if at level 3 or higher
        if (shouldShowPoodles()) {
            checkPoodleCollision();
        }
    });

    // Simplify the coordinate adjustment function for 2D
    function adjustMouseCoordinates(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    // Add function to draw the cave
    function drawCave() {
        ctx.save();
        // Draw cave opening (dark circle)
        ctx.fillStyle = '#463E3F';
        ctx.beginPath();
        ctx.ellipse(cave.x, cave.y, cave.width/2, cave.height/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Add a simple rock outline
        ctx.strokeStyle = '#2F2F2F';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    // Add function to check if a position is over the cave
    function isOverCave(x, y) {
        const dx = x - cave.x;
        const dy = y - cave.y;
        return (dx * dx)/(cave.width * cave.width/4) + (dy * dy)/(cave.height * cave.height/4) <= 1;
    }

    // Update the click handler to prevent jumping over cave
    canvas.addEventListener('click', function (e) {
        if (gameOver || isJumping) return;

        const adjustedCoords = adjustMouseCoordinates(e.clientX, e.clientY);
        
        // Check if jump would cross the cave
        if (isOverCave(adjustedCoords.x, adjustedCoords.y)) {
            return; // Prevent jumping onto the cave
        }

        // Check if jump path intersects with cave
        const dx = adjustedCoords.x - dogPosition.x;
        const dy = adjustedCoords.y - dogPosition.y;
        const steps = 10;
        for(let i = 0; i <= steps; i++) {
            const x = dogPosition.x + (dx * i/steps);
            const y = dogPosition.y + (dy * i/steps);
            if (isOverCave(x, y)) {
                return; // Prevent jumping over cave
            }
        }
        
        // If we get here, the jump is valid
        playShortSound(jumpSound);
        isJumping = true;
        jumpStartPosition = { x: dogPosition.x, y: dogPosition.y };
        jumpTargetPosition = { x: adjustedCoords.x, y: adjustedCoords.y };
        jumpStartTime = Date.now();
    });

    // Add this function to handle the jump animation
    function updateDogPosition() {
        if (!isJumping) return;

        const currentTime = Date.now();
        const elapsed = currentTime - jumpStartTime;
        const progress = Math.min(elapsed / JUMP_DURATION, 1);

        // Easing function for smooth animation
        const easeProgress = -Math.cos(progress * Math.PI) / 2 + 0.5;

        // Update dog position
        dogPosition.x = jumpStartPosition.x + (jumpTargetPosition.x - jumpStartPosition.x) * easeProgress;
        dogPosition.y = jumpStartPosition.y + (jumpTargetPosition.y - jumpStartPosition.y) * easeProgress;

        // Add a vertical jump effect
        const jumpHeight = 20;
        const verticalOffset = Math.sin(progress * Math.PI) * jumpHeight;
        dogPosition.y -= verticalOffset;

        if (progress >= 1) {
            isJumping = false;
            dogPosition.x = jumpTargetPosition.x;
            dogPosition.y = jumpTargetPosition.y;
            checkBoneCollection();
            checkFatherCollision();
        }
    }

    function checkBoneCollection() {
        const previousLength = bones.length;
        bones = bones.filter(bone => {
            const distance = Math.hypot(bone.x - dogPosition.x, bone.y - dogPosition.y);
            return distance > 20; // Remove bones when dog is close enough
        });
        // Play sound if a bone was collected
        if (bones.length < previousLength) {
            playShortSound(boneCollectSound);
        }
    }

    function checkFatherCollision() {
        // Don't check collision if dog is hiding behind a tree
        if (isDogHidingBehindTree()) return;

        const distance = Math.hypot(fatherPosition.x - dogPosition.x, fatherPosition.y - dogPosition.y);
        if (distance < 50 && !gameOver) { // Reduced collision radius from 100 to 50
            gameOver = true;
            playShortSound(fatherWakeSound);
            const currentLosses = parseInt(localStorage.getItem('gameLosses') || '0');
            localStorage.setItem('gameLosses', (currentLosses + 1).toString());
        }
    }

    function drawDog(x, y) {
        ctx.save();
        ctx.translate(x, y);

        // Body (rounder)
        ctx.fillStyle = '#8B4513';  // Warmer brown
        ctx.beginPath();
        ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lighter belly
        ctx.fillStyle = '#DEB887';  // Light brown
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 8, 0, 0, Math.PI);
        ctx.fill();

        // Head (rounder)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(-20, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#DEB887';
        ctx.beginPath();
        ctx.ellipse(-28, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(-32, 0, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears (floppy)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(-22, -12, 6, 8, -Math.PI/3, 0, Math.PI * 2);
        ctx.ellipse(-22, 12, 6, 8, Math.PI/3, 0, Math.PI * 2);
        ctx.fill();

        // Wagging tail (animated)
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const wagOffset = Math.sin(Date.now() / 100) * 5;
        ctx.moveTo(20, 0);
        ctx.quadraticCurveTo(30, wagOffset, 35, wagOffset * 0.5);
        ctx.stroke();

        // Eyes (bigger and cuter)
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-24, -4, 2.5, 0, Math.PI * 2);
        ctx.arc(-24, 4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-25, -5, 1, 0, Math.PI * 2);
        ctx.arc(-25, 3, 1, 0, Math.PI * 2);
        ctx.fill();

        // Optional: Happy mouth
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-28, 2, 3, 0, Math.PI);
        ctx.stroke();

        ctx.restore();
    }

    function drawFatherDog(x, y) {
        ctx.save();
        ctx.translate(x, y);

        // Body (larger than puppy)
        ctx.fillStyle = '#654321';  // Darker brown
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lighter belly
        ctx.fillStyle = '#8B7355';  // Light brown
        ctx.beginPath();
        ctx.ellipse(0, 8, 25, 10, 0, 0, Math.PI);
        ctx.fill();

        // Head (larger)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(-30, 0, 18, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears (larger and pointier when angry)
        ctx.beginPath();
        if (gameOver || isChasing) {
            // Angry pointed ears
            ctx.moveTo(-40, -15);
            ctx.lineTo(-45, -25);
            ctx.lineTo(-35, -15);
            ctx.moveTo(-40, 15);
            ctx.lineTo(-45, 25);
            ctx.lineTo(-35, 15);
            ctx.fillStyle = '#654321';
            ctx.fill();
        } else {
            // Sleeping floppy ears
            ctx.ellipse(-38, -10, 10, 6, -0.5, 0, Math.PI * 2);
            ctx.ellipse(-38, 10, 10, 6, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Snout
        ctx.fillStyle = '#8B7355';
        ctx.beginPath();
        ctx.ellipse(-42, 0, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(-48, 0, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (gameOver || isChasing) {
            // Angry eyes
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            // Left eye
            ctx.beginPath();
            ctx.moveTo(-35, -8);
            ctx.lineTo(-30, -4);
            ctx.moveTo(-35, -4);
            ctx.lineTo(-30, -8);
            ctx.stroke();
            // Right eye
            ctx.beginPath();
            ctx.moveTo(-35, 8);
            ctx.lineTo(-30, 4);
            ctx.moveTo(-35, 4);
            ctx.lineTo(-30, 8);
            ctx.stroke();

            // Angry eyebrows
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-28, -6);
            ctx.lineTo(-35, -10);
            ctx.moveTo(-28, 6);
            ctx.lineTo(-35, 10);
            ctx.stroke();

            // Angry mouth
            ctx.beginPath();
            ctx.moveTo(-45, 2);
            ctx.lineTo(-40, 5);
            ctx.lineTo(-45, 8);
            ctx.stroke();
        } else {
            // Sleeping eyes
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-35, -6);
            ctx.lineTo(-30, -6);
            ctx.moveTo(-35, 6);
            ctx.lineTo(-30, 6);
            ctx.stroke();

            // Only show Zzz when actually sleeping
            if (!isChasing) {
                // Zzz
                ctx.fillStyle = 'black';
                ctx.font = '14px Arial';
                ctx.fillText('z', -15, -20);
                ctx.font = '12px Arial';
                ctx.fillText('z', -20, -30);
                ctx.font = '10px Arial';
                ctx.fillText('z', -25, -38);
            }
        }

        ctx.restore();
    }

    // Add this function to draw the cute title
    function drawGameTitle() {
        const centerX = canvas.width/2;
        const y = 70;
        const text = 'Perrito Salchichón';
        
        // Draw bouncing letters
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Split text into letters and draw each one
        const letters = text.split('');
        let xOffset = -((letters.length * 30) / 2);  // Center the text
        
        letters.forEach((letter, i) => {
            const bounce = Math.sin((Date.now() / 300) + i * 0.3) * 5;  // Each letter bounces slightly out of phase
            
            // Shadow
            ctx.font = 'bold 52px "Comic Sans MS", cursive';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillText(letter, centerX + xOffset + 3, y + bounce + 3);
            
            // Main text with gradient
            ctx.font = 'bold 50px "Comic Sans MS", cursive';
            const gradient = ctx.createLinearGradient(
                centerX + xOffset, y + bounce - 25,
                centerX + xOffset, y + bounce + 25
            );
            gradient.addColorStop(0, '#FF69B4');    // Pink
            gradient.addColorStop(0.5, '#FF1493');  // Deep pink
            gradient.addColorStop(1, '#FF69B4');    // Pink
            ctx.fillStyle = gradient;
            ctx.fillText(letter, centerX + xOffset, y + bounce);
            
            // White outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.strokeText(letter, centerX + xOffset, y + bounce);
            
            xOffset += 30;  // Space between letters
        });
        
        ctx.restore();
    }

    // Add this near the top with other game state variables
    const grassPatches = Array(20).fill().map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        offset: Math.random() * 10 - 5  // Random offset for variety
    }));

    // Add tree positions initialization
    const treePositions = (() => {
        const numTrees = 8;
        const margin = 100;
        const treeAreaWidth = window.innerWidth - 2 * margin;
        return Array(numTrees).fill().map((_, i) => ({
            x: margin + (treeAreaWidth / (numTrees - 1)) * i + (Math.random() * 60 - 30),
            y: 80 + Math.random() * 40
        }));
    })();

    // Add this near the top with other game state variables
    const poodlePositions = Array(5).fill().map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        angle: Math.random() * Math.PI * 2,  // Random starting angle
        speed: 1 + Math.random(),  // Random speed between 1 and 2
        circleRadius: 50 + Math.random() * 50,  // Random circle radius
        centerX: 0,  // Will be set in init
        centerY: 0   // Will be set in init
    }));

    // Initialize poodle movement centers
    poodlePositions.forEach(poodle => {
        poodle.centerX = poodle.x;
        poodle.centerY = poodle.y;
    });

    // Function to update poodle positions
    function updatePoodlePositions() {
        poodlePositions.forEach(poodle => {
            // Update angle
            poodle.angle += poodle.speed * 0.02;

            // Calculate new position in a circular pattern
            poodle.x = poodle.centerX + Math.cos(poodle.angle) * poodle.circleRadius;
            poodle.y = poodle.centerY + Math.sin(poodle.angle) * poodle.circleRadius;

            // Keep poodles within bounds
            const margin = 50;
            if (poodle.x < margin || poodle.x > canvas.width - margin || 
                poodle.y < margin || poodle.y > canvas.height - margin) {
                // If poodle hits boundary, give it a new center point
                poodle.centerX = margin + Math.random() * (canvas.width - 2 * margin);
                poodle.centerY = margin + Math.random() * (canvas.height - 2 * margin);
                poodle.angle = Math.random() * Math.PI * 2;
            }
        });
    }

    // Add this near the top with other game state variables
    const poodleCooldowns = Array(5).fill(0);  // Cooldown timer for each poodle
    const POODLE_COOLDOWN = 1000;  // 1 second cooldown

    // Function to draw a French poodle
    function drawPoodle(x, y) {
        ctx.save();
        ctx.translate(x, y);

        // Pom-pom style body
        ctx.fillStyle = 'white';
        
        // Main body pom-pom
        for(let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(
                Math.cos(angle) * 5,
                Math.sin(angle) * 5,
                8,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Head pom-pom (larger)
        for(let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(
                -15 + Math.cos(angle) * 3,
                Math.sin(angle) * 3,
                10,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Tail pom-pom
        ctx.beginPath();
        ctx.arc(15, -5, 6, 0, Math.PI * 2);
        ctx.fill();

        // Legs (with small pom-poms)
        const legPositions = [
            {x: -8, y: 12},
            {x: 8, y: 12},
            {x: -8, y: -12},
            {x: 8, y: -12}
        ];

        legPositions.forEach(pos => {
            // Leg pom-pom
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Face details
        ctx.fillStyle = 'black';
        // Eyes
        ctx.beginPath();
        ctx.arc(-18, -3, 2, 0, Math.PI * 2);
        ctx.arc(-18, 3, 2, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.beginPath();
        ctx.arc(-22, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        // Pink tongue
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.arc(-19, 1, 2, 0, Math.PI);
        ctx.fill();

        // Optional: Add a cute pink bow
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.arc(-15, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-19, -12);
        ctx.lineTo(-11, -12);
        ctx.lineTo(-15, -8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // Modify the drawBackground function
    function drawBackground() {
        // Draw trees using stored positions
        treePositions.forEach(tree => {
            drawTree(tree.x, tree.y);
        });
        
        // Draw grass patches using pre-generated positions
        grassPatches.forEach(patch => {
            drawGrass(patch.x, patch.y, patch.offset);
        });
    }

    function drawTree(x, y) {
        ctx.save();
        // Tree trunk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x-10, y+40, 20, 40);
        
        // Tree leaves (3 circles for a cute look)
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x-20, y+20, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x+20, y+20, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Update drawGrass to use the stored offset
    function drawGrass(x, y, offset) {
        ctx.save();
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 2;
        
        // Draw three blades of grass with fixed positions
        for(let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i*5, y);
            ctx.quadraticCurveTo(
                x + i*5 + offset,
                y - 15,
                x + i*5 + offset,
                y - 30
            );
            ctx.stroke();
        }
        ctx.restore();
    }

    // Add this near the top with other game state variables
    let boneAnimationStartTime = null;
    const BONE_ANIMATION_DURATION = 1000; // Change to 1 second (from 500ms)

    // Function to animate bones moving to new positions
    function animateBones() {
        const currentTime = Date.now();
        const elapsed = currentTime - boneAnimationStartTime;
        const progress = Math.min(elapsed / BONE_ANIMATION_DURATION, 1);

        bones.forEach(bone => {
            // Calculate eased progress for smooth animation
            const easeProgress = -Math.cos(progress * Math.PI) / 2 + 0.5;

            // Add a bouncing effect
            const bounceHeight = Math.sin(progress * Math.PI) * 30; // 30 pixels max height

            // Interpolate position with bounce
            bone.x = bone.startX + (bone.targetX - bone.startX) * easeProgress;
            bone.y = bone.startY + (bone.targetY - bone.startY) * easeProgress - bounceHeight;
        });

        if (progress < 1) {
            requestAnimationFrame(animateBones);
        } else {
            // Reset start positions to target positions after animation
            bones.forEach(bone => {
                bone.startX = bone.targetX;
                bone.startY = bone.targetY;
                bone.x = bone.targetX;
                bone.y = bone.targetY;
            });
        }
    }

    // Update the checkPoodleCollision function to only work at level 3+
    function checkPoodleCollision() {
        // Only check collisions if poodles should be shown
        if (!shouldShowPoodles()) return;

        const currentTime = Date.now();
        
        poodlePositions.forEach((poodle, index) => {
            const distance = Math.hypot(poodle.x - dogPosition.x, poodle.y - dogPosition.y);
            
            // Only trigger if dog touches poodle and cooldown has expired
            if (distance < 40 && currentTime > poodleCooldowns[index]) { 
                // Set start and target positions for animation
                bones.forEach(bone => {
                    bone.startX = bone.x;
                    bone.startY = bone.y;
                    const newPos = generateBonePosition();
                    bone.targetX = newPos.x;
                    bone.targetY = newPos.y;
                });

                // Start animation
                boneAnimationStartTime = Date.now();
                animateBones();

                // Play a playful sound
                playShortSound(jumpSound);
                
                // Set cooldown for this poodle
                poodleCooldowns[index] = currentTime + POODLE_COOLDOWN;
            }
        });
    }

    // Add this function to check if poodles should be shown
    function shouldShowPoodles() {
        const wins = parseInt(localStorage.getItem('gameWins') || '0');
        return wins >= 2;  // Show poodles at level 3 (after 2 wins)
    }

    // Add this near the top with other game state variables
    let isChasing = false;
    const CHASE_SPEED_INITIAL = 3;  // Initial speed when father wakes up
    const CHASE_SPEED_MAX = 6;      // Maximum speed
    const CHASE_ACCELERATION = 0.02; // How quickly the father speeds up
    let currentChaseSpeed = CHASE_SPEED_INITIAL;

    // Add this function to check if dog is hiding behind a tree
    function isDogHidingBehindTree() {
        return treePositions.some(tree => {
            const distanceToTree = Math.hypot(tree.x - dogPosition.x, tree.y - dogPosition.y);
            return distanceToTree < 50;  // Distance threshold for hiding
        });
    }

    // Update the father position function to include acceleration
    function updateFatherPosition() {
        if (!isChasing) return;

        // Gradually increase speed up to the maximum
        currentChaseSpeed = Math.min(
            currentChaseSpeed + CHASE_ACCELERATION,
            CHASE_SPEED_MAX
        );

        // If father crosses the cave, return to corner and go back to sleep
        if (isOverCave(fatherPosition.x, fatherPosition.y)) {
            isChasing = false;
            currentChaseSpeed = CHASE_SPEED_INITIAL;  // Reset speed when going back to sleep
            fatherPosition.x = window.innerWidth - 100;
            fatherPosition.y = window.innerHeight - 100;
            
            // Reset the timer to give 10 seconds
            gameStartTime = Date.now() - ((fatherSleepTime - 10) * 1000);  // Set time remaining to 10 seconds
            
            // Play a success sound
            playShortSound(boneCollectSound);
            
            // Show a message that time was reset
            ctx.save();
            ctx.fillStyle = 'green';
            ctx.font = 'bold 24px "Comic Sans MS"';
            ctx.textAlign = 'center';
            ctx.fillText('¡+10 segundos!', canvas.width/2, canvas.height/2 - 50);
            ctx.restore();
            
            return;
        }

        // If dog is hiding behind a tree
        if (isDogHidingBehindTree()) {
            // Add visual indicator that dog is hidden
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#90EE90';  // Light green
            ctx.beginPath();
            ctx.arc(dogPosition.x, dogPosition.y, 30, 0, Math.PI * 2);
            ctx.fill();
            
            // Add "Hidden!" text
            ctx.fillStyle = '#228B22';  // Dark green
            ctx.font = 'bold 14px "Comic Sans MS"';
            ctx.textAlign = 'center';
            ctx.fillText('¡Escondido!', dogPosition.x, dogPosition.y - 40);
            ctx.restore();
            
            // Stop father's movement when dog is hidden
            return;
        }

        // Calculate direction to player
        const dx = dogPosition.x - fatherPosition.x;
        const dy = dogPosition.y - fatherPosition.y;
        const distance = Math.hypot(dx, dy);

        // Check if there's a tree between father and dog
        const isTreeBlocking = treePositions.some(tree => {
            // Calculate if tree is between father and dog
            const treeDistance = Math.hypot(tree.x - fatherPosition.x, tree.y - fatherPosition.y);
            const dogDistance = distance;
            
            if (treeDistance > dogDistance) return false; // Tree is further than dog
            
            // Calculate if tree is in the path
            const angle = Math.atan2(dy, dx);
            const treeAngle = Math.atan2(tree.y - fatherPosition.y, tree.x - fatherPosition.x);
            const angleDiff = Math.abs(angle - treeAngle);
            
            return angleDiff < 0.3 && treeDistance < dogDistance; // Tree is in line of sight
        });

        // If tree is blocking the view, father moves randomly
        if (isTreeBlocking) {
            // Random movement when view is blocked
            fatherPosition.x += (Math.random() - 0.5) * currentChaseSpeed;
            fatherPosition.y += (Math.random() - 0.5) * currentChaseSpeed;
            return;
        }

        if (distance < 50) {  // Father caught the player
            gameOver = true;
            const currentLosses = parseInt(localStorage.getItem('gameLosses') || '0');
            localStorage.setItem('gameLosses', (currentLosses + 1).toString());
        } else {
            // Move father towards player with current speed
            const angle = Math.atan2(dy, dx);
            fatherPosition.x += Math.cos(angle) * currentChaseSpeed;
            fatherPosition.y += Math.sin(angle) * currentChaseSpeed;
        }
    }

    // Update the gameLoop function to include the win condition
    function gameLoop() {
        // Calculate time elapsed inside the game loop
        const timeElapsed = (Date.now() - gameStartTime) / 1000;

        // Check if father should wake up and start chasing
        if (timeElapsed >= fatherSleepTime && !isChasing && !gameOver) {
            isChasing = true;
            playShortSound(fatherWakeSound);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        ctx.fillStyle = '#90EE90';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw decorative elements
        drawBackground();
        
        // Draw cave (before other elements)
        drawCave();

        // Draw game title
        drawGameTitle();

        // Only show and update poodles if at level 3 or higher
        if (shouldShowPoodles() && !gameOver) {
            updatePoodlePositions();
            poodlePositions.forEach(poodle => {
                drawPoodle(poodle.x, poodle.y);
            });
        }

        // Draw dog
        drawDog(dogPosition.x, dogPosition.y);

        // Draw bones
        ctx.fillStyle = 'white';
        bones.forEach(bone => {
            bone.draw(ctx);
        });

        // Draw sleeping father at dynamic position
        drawFatherDog(fatherPosition.x, fatherPosition.y);

        // Check win condition
        if (bones.length === 0 && !gameOver) {
            gameOver = true;
            // Create continue button for harder level
            const continueButton = document.createElement('button');
            continueButton.textContent = 'Continuar al siguiente nivel';
            continueButton.style.position = 'absolute';
            continueButton.style.left = '50%';
            continueButton.style.top = '300px';
            continueButton.style.transform = 'translateX(-50%)';
            continueButton.onclick = () => {
                const currentWins = parseInt(localStorage.getItem('gameWins') || '0');
                localStorage.setItem('gameWins', (currentWins + 1).toString());
                window.location.reload();
            };
            document.body.appendChild(continueButton);
        }

        if (!gameOver) {
            // Update father position if chasing
            if (isChasing) {
                updateFatherPosition();
            }

            // Draw timer and stats only when game is active
            ctx.fillStyle = 'black';
            ctx.font = '20px "Comic Sans MS", cursive';
            const losses = parseInt(localStorage.getItem('gameLosses') || '0');
            ctx.fillText(`Tiempo: ${Math.ceil(fatherSleepTime - timeElapsed)}s`, 10, 30);
            ctx.fillText(`Intentos fallidos: ${losses}`, 10, 60);
            ctx.fillText(`Huesos restantes: ${bones.length}`, 10, 90);
            
            // Update dog position if jumping
            updateDogPosition();
            
            // Add this line to check poodle collisions
            checkPoodleCollision();
            
            requestAnimationFrame(gameLoop);
        }

        // Draw game over messages and update button positions
        if (gameOver) {
            const centerX = canvas.width / 2;
            ctx.textAlign = 'center';
            ctx.font = '30px Arial';
            
            if (bones.length === 0) {
                ctx.fillStyle = 'green';
                ctx.fillText('¡Ganaste! ¡Todos los huesos fueron recogidos!', centerX, canvas.height / 2);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillText(timeElapsed >= fatherSleepTime ? 
                    '¡Se acabó el juego, el papá se despertó!' : 
                    '¡Despertaste al papá!', centerX, canvas.height / 2);

                // Create reset button for loss condition if it doesn't exist
                if (!document.querySelector('button')) {
                    // Create continue button
                    const continueButton = document.createElement('button');
                    continueButton.textContent = 'Intentar de nuevo';
                    continueButton.style.position = 'absolute';
                    continueButton.style.left = '50%';
                    continueButton.style.top = '300px';
                    continueButton.style.transform = 'translateX(-50%)';
                    continueButton.onclick = () => {
                        window.location.reload();
                    };
                    document.body.appendChild(continueButton);

                    // Create reset to easy mode button
                    const resetButton = document.createElement('button');
                    resetButton.textContent = 'Reiniciar desde nivel fácil';
                    resetButton.style.position = 'absolute';
                    resetButton.style.left = '50%';
                    resetButton.style.top = '250px';
                    resetButton.style.transform = 'translateX(-50%)';
                    resetButton.onclick = () => {
                        localStorage.setItem('gameWins', '0');
                        localStorage.setItem('gameLosses', '0');
                        window.location.reload();
                    };
                    document.body.appendChild(resetButton);
                }
            }

            // Update button positions
            const buttons = document.querySelectorAll('button');
            buttons.forEach((button, index) => {
                button.style.top = `${canvas.height / 2 + 50 + index * 60}px`;
                button.style.left = '50%';
                button.style.transform = 'translateX(-50%)';
            });
        }
    }

    gameLoop();
});