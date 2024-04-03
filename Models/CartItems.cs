using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookShop.Models
{
    public class CartItems
    {


        [Key]
        public int BookID { get; set; }
        public Book Book { get; set; }


  
        public int Quantity { get; set; } = 1;
    }
}
