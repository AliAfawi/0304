using System.ComponentModel.DataAnnotations;

namespace BookShop.Models
{
    public class Book
    {
        [Key]
        public int BookID { get; set; }
        public string Title { get; set; }
        public string Author { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }

        // Navigation property for CartItem
        public List<CartItems> CartItems { get; set; }
        // Navigation property for OrderDetails

        public string ImgUrl { get; set; }

        public string description { get; set; }

    }
}
