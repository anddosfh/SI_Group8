import { ArrowUpRight, Plus } from "lucide-react";

export default function ProductCard({ product, onAdd, onDetails }) {
  const isErpProduct = Boolean(product.erp_product_id);
  const outOfStock = isErpProduct && Number(product.stock) <= 0;

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

          {isErpProduct && (
            <p className="product-description">
              {outOfStock
                ? "Currently out of stock"
                : `${product.stock} available`}
            </p>
          )}
        </div>

        <div className="product-buy">
          <strong>€{Number(product.price).toFixed(2)}</strong>

          <button
            className="add-button"
            onClick={() => onAdd(product)}
            disabled={outOfStock}
            aria-label={
              outOfStock
                ? `${product.name} is out of stock`
                : `Add ${product.name} to bag`
            }
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}