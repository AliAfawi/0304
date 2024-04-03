using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookShop.Migrations
{
    /// <inheritdoc />
    public partial class TheCart : Migration
    {
        public string SessionId { get; internal set; }
        public string CustomerId { get; internal set; }

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Carts_UserID",
                table: "Carts");

            migrationBuilder.AddColumn<int>(
                name: "TheCartCartID",
                table: "CartItems",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Cartsitems",
                columns: table => new
                {
                    CartItemId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BookID = table.Column<int>(type: "int", nullable: false),
                    CartID = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cartsitems", x => x.CartItemId);
                    table.ForeignKey(
                        name: "FK_Cartsitems_Books_BookID",
                        column: x => x.BookID,
                        principalTable: "Books",
                        principalColumn: "BookID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Cartsitems_Carts_CartID",
                        column: x => x.CartID,
                        principalTable: "Carts",
                        principalColumn: "CartID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TheCarts",
                columns: table => new
                {
                    CartID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TheCarts", x => x.CartID);
                    table.ForeignKey(
                        name: "FK_TheCarts_AspNetUsers_UserID",
                        column: x => x.UserID,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Carts_UserID",
                table: "Carts",
                column: "UserID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CartItems_TheCartCartID",
                table: "CartItems",
                column: "TheCartCartID");

            migrationBuilder.CreateIndex(
                name: "IX_Cartsitems_BookID",
                table: "Cartsitems",
                column: "BookID");

            migrationBuilder.CreateIndex(
                name: "IX_Cartsitems_CartID",
                table: "Cartsitems",
                column: "CartID");

            migrationBuilder.CreateIndex(
                name: "IX_TheCarts_UserID",
                table: "TheCarts",
                column: "UserID");

            migrationBuilder.AddForeignKey(
                name: "FK_CartItems_TheCarts_TheCartCartID",
                table: "CartItems",
                column: "TheCartCartID",
                principalTable: "TheCarts",
                principalColumn: "CartID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CartItems_TheCarts_TheCartCartID",
                table: "CartItems");

            migrationBuilder.DropTable(
                name: "Cartsitems");

            migrationBuilder.DropTable(
                name: "TheCarts");

            migrationBuilder.DropIndex(
                name: "IX_Carts_UserID",
                table: "Carts");

            migrationBuilder.DropIndex(
                name: "IX_CartItems_TheCartCartID",
                table: "CartItems");

            migrationBuilder.DropColumn(
                name: "TheCartCartID",
                table: "CartItems");

            migrationBuilder.CreateIndex(
                name: "IX_Carts_UserID",
                table: "Carts",
                column: "UserID");
        }
    }
}
