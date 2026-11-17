import { ArrowUpRight, Plus } from "lucide-react";

// Lab 3: availability comes live from the ERP with every catalogue load.
export const availabilityLabel = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  unknown: "Availability unknown",
  not_sold: "Not available"
};

export default function ProductCard({ product, onAdd, onDetails }) {
  const canBuy = product.availability === "in_stock";

  return (
    <article className="product-card">
      <button
        className="product-image"
        onClick={() => onDetails(product)}
        aria-label={`View ${product.name}`}
      >
        <span className="product-number">
          {String(product.id).padStart(2, "0")}
        </span>

        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src =
              "https://placehold.co/600x500/f0f0ec/222?text=NOVA";
          }}
        />

        <span className="image-arrow">
          <ArrowUpRight size={19} />
        </span>
      </button>

      <div className="product-info">
        <div>
          <p className="product-category">{product.category}</p>
          <h3>{product.name}</h3>
          <p className="product-description">{product.description}</p>

          <p className={`availability availability-${product.availability}`}>
            {availabilityLabel[product.availability] || availabilityLabel.unknown}
          </p>
        </div>

        <div className="product-buy">
          <strong>€{Number(product.price).toFixed(2)}</strong>

          <button
            className="add-button"
            onClick={() => onAdd(product)}
            disabled={!canBuy}
            aria-label={
              canBuy
                ? `Add ${product.name} to bag`
                : `${product.name}: ${availabilityLabel[product.availability] || availabilityLabel.unknown}`
            }
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
