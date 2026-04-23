export function useDraggable(node, onPositionChange, scale = 1) {
    let startX, startY;
    let initialX, initialY;

    const onMouseDown = (e) => {
        // Mencegah bubbling agar tidak memicu Pan kanvas
        e.stopPropagation();
        
        startX = e.clientX;
        startY = e.clientY;
        initialX = node.x;
        initialY = node.y;

        const onMouseMove = (e) => {
            // Kalkulasi selisih mouse dibagi dengan skala zoom
            const dx = (e.clientX - startX) / scale;
            const dy = (e.clientY - startY) / scale;

            onPositionChange({
                x: Math.round(initialX + dx),
                y: Math.round(initialY + dy)
            });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    return { onMouseDown };
}
