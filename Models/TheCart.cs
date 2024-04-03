using System.ComponentModel.DataAnnotations;

namespace BookShop.Models
{
    public class TheCart
    {
        [Key]
        public string UserID { get; set; }
        public string SessionId { get; set; }
        public List<CartItems> CartItems { get; set; } = new List<CartItems>();
    }
}
