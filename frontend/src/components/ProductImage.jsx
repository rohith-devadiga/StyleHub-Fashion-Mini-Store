export default function ProductImage({ product, className = "" }) {
  if (product.image_url) {
    return <img className={`product-img ${className}`} src={product.image_url} alt={product.name} loading="lazy" />;
  }
  return <div className={`product-img placeholder ${className}`}>{product.name.charAt(0).toUpperCase()}</div>;
}
