export function FloatingFoodBackdrop() {
  const foods = [
    ["🍎", "food-float-one"],
    ["🥕", "food-float-two"],
    ["🥖", "food-float-three"],
    ["🥫", "food-float-four"],
    ["🍲", "food-float-five"],
    ["🥬", "food-float-six"],
    ["🍌", "food-float-seven"],
    ["🥛", "food-float-eight"],
  ] as const;

  return (
    <div className="food-float-layer" aria-hidden>
      {foods.map(([food, className]) => (
        <span key={className} className={`food-float ${className}`}>{food}</span>
      ))}
    </div>
  );
}
