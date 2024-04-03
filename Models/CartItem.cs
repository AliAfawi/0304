using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace BookShop.Models
{
    public class CartItem
    {
        [Key]
        public string CartItemID { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }
        public float TotalPrice { get; set; }
        public List<Order> orders { get; set; }
    }
}
