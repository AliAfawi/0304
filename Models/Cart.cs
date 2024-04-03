using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace BookShop.Models
{
    public class Cart
    {
        [Key]
        public int CartID { get; set; }

        [ForeignKey("User")]
        public string UserID { get; set; } // This should be a string to match IdentityUser's Id type
        public User User { get; set; }

        // Navigation property for CartItems
        public List<CartItems> CartItems { get; set; }
    }

}
