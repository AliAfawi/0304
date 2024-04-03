using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookShop.Models
{
    public class OrderBooks
    {
        [Key]
        public int OrderBookId { get; set; }

        [ForeignKey("Order")]
        public int OrderID { get; set; }
        public Order Order { get; set; }

        // Foreign key for Product
        [ForeignKey("Book")]
        public int BookID { get; set; }
        public Book book { get; set; }

        public int Quantity { get; set; }
        public double UnitPrice { get; set; }

    }
}
